import type { MunicipalReportDistributionItem } from "@/contracts/municipalReport";
import { formatPercentage } from "@/utils/municipalReportValue";
import type { ReportSeveritySpec } from "@/utils/reportVariableProfile";

/**
 * O id do Monitor de Secas da ANA no catálogo. A frase deste módulo só vale
 * para ele: fala em "seca" e numera as classes como D0–D4, o que não faz
 * sentido em outro índice com ordem de gravidade.
 */
export const DROUGHT_MONITOR_PANEL_LAYER_ID = "monitor-de-seca-ana";

export const DROUGHT_MONITOR_SITUATION_VARIABLE = {
  key: "situacao_seca",
  token: "[situacao_seca]",
  description:
    "Frase de abertura do Monitor de Secas, já com o território: quanto da área está sem seca e em seca, as classes mais graves presentes, a classe de seca predominante e o restante.",
} as const;

/**
 * Abaixo disso a classe é ruído de borda do território: não é citada, mas
 * continua somando nos totais.
 */
const MIN_PERCENTAGE = 0.5;
/** "Quase tudo sem seca": a frase vira um resumo curto do pouco que resta. */
const MOSTLY_NO_DROUGHT_PERCENTAGE = 95;
/** As três classes de seca mais graves (D2, D3, D4) são sempre destacadas. */
const WORST_CLASS_COUNT = 3;

const LOCALE = "pt-BR";

interface DroughtClass {
  id: string;
  name: string;
  percentage: number;
}

/**
 * "a, b e c". Quando os próprios itens têm vírgula ("Seca grave (D2), presente
 * em 10,00% da área"), o "e" ganha uma vírgula antes para não colar no item.
 */
function joinWithAnd(items: readonly string[]) {
  if (items.length <= 1) return items[0] ?? "";
  const glue = items.some((item) => item.includes(",")) ? ", e " : " e ";
  return `${items.slice(0, -1).join(", ")}${glue}${items.at(-1)}`;
}

function percent(value: number) {
  return `${formatPercentage(value, LOCALE)}%`;
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * O parágrafo de abertura do Monitor de Secas, na lógica combinada com a ANA:
 * em vez de citar só a classe que ocupa mais área — que num recorte grande é
 * quase sempre "Sem seca" —, o texto mostra quanto da área está em seca,
 * destaca as classes mais graves presentes mesmo quando são pequenas, aponta a
 * classe de seca predominante e fecha com o restante.
 *
 * As classes de seca são numeradas pela posição na escala do catálogo (a
 * primeira depois de "Sem seca" é D0). Devolve `null` quando a escala não tem
 * classe neutra ou a distribuição está vazia: aí a variável não resolve e o
 * texto do catálogo mostra o colchete, como qualquer variável sem dado.
 *
 * @example
 * buildDroughtMonitorSituation("No Brasil", distribution, severity);
 * // "No Brasil, 35,10% da área está sem seca e 64,90% em algum nível de seca. …"
 */
export function buildDroughtMonitorSituation(
  place: string,
  distribution: readonly MunicipalReportDistributionItem[],
  severity: ReportSeveritySpec | undefined,
): string | null {
  const neutralId = severity?.neutralClassId;
  if (!severity || !neutralId || distribution.length === 0) return null;

  const percentageOf = (id: string) =>
    distribution.find((item) => item.id === id)?.percentage ?? 0;
  const labelOf = (id: string) =>
    distribution.find((item) => item.id === id)?.label ?? id;

  const noDrought = percentageOf(neutralId);
  // Da mais grave para a menos grave, que é a ordem em que o texto as cita.
  const droughtClasses: DroughtClass[] = severity.order
    .filter((id) => id !== neutralId)
    .map((id, index) => ({
      id,
      name: `${labelOf(id)} (D${index})`,
      percentage: percentageOf(id),
    }))
    .reverse();
  // O complemento de "Sem seca", e não a soma das classes de seca: a fonte às
  // vezes soma 100,1%, e a abertura tem que fechar em 100% para quem confere.
  const inDrought = Math.max(0, 100 - noDrought);
  const present = droughtClasses.filter(
    (item) => item.percentage > MIN_PERCENTAGE,
  );

  if (present.length === 0) {
    return `${place}, toda a área está sem seca (${percent(noDrought)}), sem nenhuma classe de seca observada no período.`;
  }

  if (noDrought <= MIN_PERCENTAGE && present.length === 1) {
    return `${place}, toda a área está em ${present[0].name}.`;
  }

  if (noDrought >= MOSTLY_NO_DROUGHT_PERCENTAGE) {
    const rest =
      present.length === 1
        ? `correspondem à ${present[0].name}`
        : `distribuem-se entre ${joinWithAnd(
            present.map((item) => `${item.name}, com ${percent(item.percentage)}`),
          )}`;
    return `${place}, ${percent(noDrought)} da área está sem seca. Os ${percent(inDrought)} restantes ${rest}.`;
  }

  const sentences = [
    noDrought > MIN_PERCENTAGE
      ? `${place}, ${percent(noDrought)} da área está sem seca e ${percent(inDrought)} em algum nível de seca.`
      : `${place}, toda a área está em algum nível de seca.`,
  ];
  const mentioned = new Set<string>();

  // 1. As classes mais graves presentes, mesmo quando pequenas.
  const worstIds = new Set(
    droughtClasses.slice(0, WORST_CLASS_COUNT).map(({ id }) => id),
  );
  const worst = present.filter((item) => worstIds.has(item.id));

  // 2. A classe de seca predominante. O empate compara o que o leitor vê, o
  // percentual já arredondado, e não o número cru.
  const top = Math.max(...present.map((item) => item.percentage));
  const tied = present.filter(
    (item) => percent(item.percentage) === percent(top),
  );
  const worstIsPredominant =
    tied.length === 1 && worstIds.has(tied[0].id) && present.length > 1;

  if (worst.length === 1) {
    const [item] = worst;
    sentences.push(
      `Observa-se como pior classe a ${item.name}, presente em ${percent(item.percentage)} da área${worstIsPredominant ? ", sendo também a classe de seca predominante" : ""}.`,
    );
  } else if (worst.length > 1) {
    const items = worst.map(
      (item) => `a ${item.name}, presente em ${percent(item.percentage)} da área`,
    );
    sentences.push(
      `Observam-se como piores classes ${joinWithAnd(items)}.${worstIsPredominant ? ` A ${tied[0].name} é também a classe de seca predominante.` : ""}`,
    );
  }
  worst.forEach(({ id }) => mentioned.add(id));

  const predominant = tied.filter((item) => !mentioned.has(item.id));
  if (present.length === 1) {
    // Uma classe só não "predomina" sobre ninguém.
    if (predominant.length === 1) {
      sentences.push(
        `A seca presente é a ${predominant[0].name}, em ${percent(predominant[0].percentage)} da área.`,
      );
      mentioned.add(predominant[0].id);
    }
  } else if (predominant.length === 1 && tied.length === 1) {
    sentences.push(
      `A classe de seca predominante é a ${predominant[0].name}, presente em ${percent(predominant[0].percentage)} da área.`,
    );
    mentioned.add(predominant[0].id);
  } else if (predominant.length > 0 && tied.length > 1) {
    const alreadyCited = tied.find((item) => mentioned.has(item.id));
    if (predominant.length === 1 && alreadyCited) {
      sentences.push(
        `A ${predominant[0].name} também corresponde a ${percent(predominant[0].percentage)} da área, o mesmo percentual da ${alreadyCited.name} citada acima.`,
      );
    } else {
      sentences.push(
        `${capitalize(joinWithAnd(predominant.map((item) => `a ${item.name}`)))} são as classes de seca predominantes, com ${percent(top)} da área cada.`,
      );
    }
    predominant.forEach(({ id }) => mentioned.add(id));
  }

  // 3. O restante, já nomeado: sobram no máximo as duas classes mais leves.
  const remaining = present.filter((item) => !mentioned.has(item.id));
  if (remaining.length === 1) {
    sentences.push(
      `A classe restante, ${remaining[0].name}, corresponde a ${percent(remaining[0].percentage)} da área.`,
    );
  } else if (remaining.length > 1) {
    const sum = remaining.reduce((total, item) => total + item.percentage, 0);
    sentences.push(
      `As demais classes, ${joinWithAnd(remaining.map(({ name }) => name))}, somam ${percent(sum)} da área.`,
    );
  }

  return sentences.join(" ");
}
