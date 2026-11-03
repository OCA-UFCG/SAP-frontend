import type { MunicipalReportDistributionItem } from "@/contracts/municipalReport";
import { formatPercentage } from "@/utils/municipalReportValue";
import type { ReportSeveritySpec } from "@/utils/reportVariableProfile";

/**
 * Abaixo disso a classe não é citada: são os pixels da borda do território,
 * que somam ruído à frase sem dizer nada sobre ele. Ela continua contando nos
 * totais, então "64,90% da área" inclui uma seca grave de 0,20%.
 */
const MIN_CITED_PERCENTAGE = 1;

/**
 * Até quatro classes a frase cita todas; com mais, cita três e soma o resto.
 * Escrever "as demais classes somam 1,50%" quando o resto é uma classe só
 * esconderia o nome dela à toa.
 */
const MAX_CITED_CLASSES = 4;
const CITED_CLASSES_WHEN_GROUPED = 3;

/** A partir daqui o número já sai "100,00", e "toda a área" diz o mesmo. */
const WHOLE_AREA_PERCENTAGE = 99.95;

type DistributionItem = Pick<
  MunicipalReportDistributionItem,
  "id" | "label" | "percentage"
>;

type Translate = (key: string, values?: Record<string, string>) => string;

/**
 * O texto em português de cada pedaço da frase. É também o que o servidor usa,
 * porque o relatório monta as variáveis do catálogo em pt-BR e não tem `t`.
 * Precisa ficar igual a `distribution` em `translations/pt/MunicipalReport.json`.
 */
const PT_MESSAGES: Record<string, string> = {
  item: "{className} ({percentage}%)",
  wholeArea: "toda a área",
  areaShare: "{percentage}% da área",
  whole: "toda a área está na classe {className}",
  single: "a classe {className} ocupa {percentage}% da área",
  listed: "a área se divide entre {classes}",
  others: ", e as demais classes somam {percentage}%",
  worseOne: "{share} está na classe {className}, pior que {neutral}",
  worseMany: "{share} está em classes piores que {neutral}: {classes}",
  worseOthers: "; as demais classes piores somam {percentage}%",
  restOne: "; o restante ({percentage}%) está em {className}",
  restBoth:
    "; {neutralPercentage}% está em {neutral} e {betterPercentage}% em {better}",
  betterClasses: "classes melhores que {neutral}",
};

function createMessages(t: Translate | undefined) {
  return (key: string, values: Record<string, string> = {}) =>
    t
      ? t(`distribution.${key}`, values)
      : PT_MESSAGES[key].replace(
          /\{(\w+)\}/g,
          (_, name: string) => values[name] ?? "",
        );
}

/**
 * O trecho da "Situação atual" que conta como a área do território se reparte
 * entre as classes, e não só qual delas é a maior.
 *
 * Citar só a predominante engana numa escala de gravidade: no Brasil, em
 * janeiro de 2026, "predomina Sem seca (35,10%)" esconde 64,90% da área em seca.
 * Por isso há duas formas:
 *
 * - **Com ordem de gravidade e classe normal declaradas**, a frase abre pelo
 *   total pior que a normal e cita essas classes na ordem da escala, do menos
 *   para o mais grave. Cortar pela área esconderia justamente a classe grave
 *   que é pequena.
 * - **Sem ordem**, cita as classes da maior para a menor área. A ordem da
 *   legenda não diz nada sobre o território.
 *
 * Devolve `null` quando a distribuição está vazia ou zerada, para quem chama
 * manter a frase que já tinha.
 *
 * @example
 * describeClassDistribution(brasilJan2026, monitorSeverity, "pt-BR");
 * // "64,90% da área está em classes piores que Sem seca: Seca fraca (31,90%),
 * // Seca moderada (18,40%), Seca grave (10,00%) e Seca extrema (4,60%); o
 * // restante (35,10%) está em Sem seca"
 */
export function describeClassDistribution(
  distribution: readonly DistributionItem[],
  severity: ReportSeveritySpec | undefined,
  locale: string,
  t?: Translate,
  translateClass: (label: string) => string = (label) => label,
): string | null {
  const total = sum(distribution);
  if (total <= 0) return null;

  const message = createMessages(t);
  const percentage = (value: number) => formatPercentage(value, locale);
  const list = (items: readonly DistributionItem[]) =>
    new Intl.ListFormat(locale, { type: "conjunction" }).format(
      items.map((item) =>
        message("item", {
          className: translateClass(item.label),
          percentage: percentage(item.percentage),
        }),
      ),
    );

  const bySeverity = splitBySeverity(distribution, severity);
  if (bySeverity && sum(bySeverity.worse) >= MIN_CITED_PERCENTAGE) {
    const { worse, neutral, better } = bySeverity;
    const worseTotal = sum(worse);
    const neutralName = translateClass(neutral.label);
    const cited = worse.filter(isCited);
    const shown =
      cited.length > MAX_CITED_CLASSES
        ? cited.slice(-CITED_CLASSES_WHEN_GROUPED)
        : cited;
    const share =
      worseTotal >= WHOLE_AREA_PERCENTAGE
        ? message("wholeArea")
        : message("areaShare", { percentage: percentage(worseTotal) });

    let text =
      shown.length === 1
        ? message("worseOne", {
            share,
            className: translateClass(shown[0].label),
            neutral: neutralName,
          })
        : message("worseMany", {
            share,
            neutral: neutralName,
            classes: list(shown),
          });
    if (shown.length < cited.length) {
      text += message("worseOthers", {
        percentage: percentage(sum(cited) - sum(shown)),
      });
    }

    const betterTotal = sum(better);
    const citedBetter = better.filter(isCited);
    const betterName =
      citedBetter.length === 1 &&
      betterTotal - citedBetter[0].percentage < MIN_CITED_PERCENTAGE
        ? translateClass(citedBetter[0].label)
        : message("betterClasses", { neutral: neutralName });
    const hasNeutral = neutral.percentage >= MIN_CITED_PERCENTAGE;
    const hasBetter = betterTotal >= MIN_CITED_PERCENTAGE;
    if (hasNeutral && hasBetter) {
      text += message("restBoth", {
        neutralPercentage: percentage(neutral.percentage),
        neutral: neutralName,
        betterPercentage: percentage(betterTotal),
        better: betterName,
      });
    } else if (hasNeutral || hasBetter) {
      text += message("restOne", {
        percentage: percentage(hasNeutral ? neutral.percentage : betterTotal),
        className: hasNeutral ? neutralName : betterName,
      });
    }
    return text;
  }

  const byArea = distribution
    .filter(isCited)
    .sort((left, right) => right.percentage - left.percentage);
  if (byArea.length === 0) return null;
  if (byArea[0].percentage >= WHOLE_AREA_PERCENTAGE) {
    return message("whole", { className: translateClass(byArea[0].label) });
  }

  const shown =
    byArea.length > MAX_CITED_CLASSES
      ? byArea.slice(0, CITED_CLASSES_WHEN_GROUPED)
      : byArea;
  let text =
    shown.length === 1
      ? message("single", {
          className: translateClass(shown[0].label),
          percentage: percentage(shown[0].percentage),
        })
      : message("listed", { classes: list(shown) });
  const rest = total - sum(shown);
  if (rest >= MIN_CITED_PERCENTAGE) {
    text += message("others", { percentage: percentage(rest) });
  }
  return text;
}

/**
 * As classes separadas pela classe normal. Só existe quando a ordem declarada
 * tem uma classe normal que o índice de fato publica; sem ela não há o que
 * chamar de "pior".
 */
function splitBySeverity(
  distribution: readonly DistributionItem[],
  severity: ReportSeveritySpec | undefined,
) {
  if (!severity?.neutralClassId) return null;
  const byId = new Map(distribution.map((item) => [item.id, item]));
  const neutral = byId.get(severity.neutralClassId);
  if (!neutral) return null;

  const neutralIndex = severity.order.indexOf(severity.neutralClassId);
  const pick = (ids: readonly string[]) =>
    ids.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
  return {
    worse: pick(severity.order.slice(neutralIndex + 1)),
    neutral,
    better: pick(severity.order.slice(0, neutralIndex)),
  };
}

function isCited(item: DistributionItem) {
  return item.percentage >= MIN_CITED_PERCENTAGE;
}

function sum(items: readonly DistributionItem[]) {
  return items.reduce((total, item) => total + item.percentage, 0);
}
