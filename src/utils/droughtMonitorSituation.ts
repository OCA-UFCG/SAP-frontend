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
    "Frase de abertura do Monitor de Secas, já com o território: quanto da área está sem seca, as classes mais graves presentes, a classe de seca predominante e o restante.",
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
 * "a, b e c". Com `serialComma`, o "e" ganha uma vírgula antes, para não colar
 * em itens que já têm vírgula ("Seca grave (D2), presente em 10,00% da área").
 */
function joinWithAnd(items: readonly string[], serialComma = false) {
  if (items.length <= 1) return items[0] ?? "";
  const glue = serialComma ? ", e " : " e ";
  return `${items.slice(0, -1).join(", ")}${glue}${items.at(-1)}`;
}

function percent(value: number) {
  return `${formatPercentage(value, LOCALE)}%`;
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * O parágrafo de abertura do Monitor de Secas, na lógica que o Ulisses fez no
 * Earth Engine com a ANA (`gerarCorpoTextoMonitorSecas`): em vez de citar só a
 * classe que ocupa mais área, o texto diz quanto está sem seca, destaca as
 * classes mais graves presentes mesmo quando são pequenas, aponta a classe de
 * seca predominante e fecha com o restante. Muda só a forma dos números (duas
 * casas, como a tabela do relatório) e o território, que já vem com a
 * preposição certa.
 *
 * As classes de seca são numeradas pela posição na escala do catálogo (a
 * primeira depois de "Sem seca" é D0). Devolve `null` quando a escala não tem
 * classe neutra ou a distribuição está vazia: aí a variável não resolve e o
 * texto do catálogo mostra o colchete, como qualquer variável sem dado.
 *
 * @example
 * buildDroughtMonitorSituation("No Brasil", distribution, severity);
 * // "No Brasil, 35,10% da área está sem seca. Observam-se como piores classes …"
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
  // vezes soma 100,1%, e o resumo tem que fechar em 100% para quem confere.
  const inDrought = Math.max(0, 100 - noDrought);
  const present = droughtClasses.filter(
    (item) => item.percentage > MIN_PERCENTAGE,
  );

  if (noDrought >= 100 - MIN_PERCENTAGE) {
    return `${place}, toda a área está sem seca (${percent(noDrought)}), sem nenhuma classe de seca observada no período.`;
  }

  if (noDrought >= MOSTLY_NO_DROUGHT_PERCENTAGE) {
    const opening = `${place}, ${percent(noDrought)} da área está sem seca.`;
    if (present.length === 0) return opening;
    const rest =
      present.length === 1
        ? `correspondem à ${present[0].name}`
        : `distribuem-se entre ${joinWithAnd(
            present.map((item) => `${item.name} (${percent(item.percentage)})`),
          )}`;
    return `${opening} Os ${percent(inDrought)} restantes ${rest}.`;
  }

  const sentences: string[] = [];
  const mentioned = new Set<string>();
  // A primeira frase leva o território; as seguintes começam com maiúscula.
  const sentence = (fragment: string) =>
    sentences.length === 0 ? `${place}, ${fragment}` : capitalize(fragment);

  if (noDrought > MIN_PERCENTAGE) {
    sentences.push(sentence(`${percent(noDrought)} da área está sem seca.`));
  }

  // 1. As classes mais graves presentes, mesmo quando pequenas.
  const worstIds = new Set(
    droughtClasses.slice(0, WORST_CLASS_COUNT).map(({ id }) => id),
  );
  const worst = present.filter((item) => worstIds.has(item.id));
  let worstSentence: string | null = null;
  if (worst.length === 1) {
    const [item] = worst;
    worstSentence = `observa-se como pior classe a ${item.name}, presente em ${percent(item.percentage)} da área.`;
  } else if (worst.length > 1) {
    const items = worst.map(
      (item) =>
        `a ${item.name}, presente em ${percent(item.percentage)} da área`,
    );
    worstSentence = `observam-se como piores classes ${joinWithAnd(items, true)}.`;
  }
  worst.forEach(({ id }) => mentioned.add(id));

  // 2. A classe de seca predominante. O empate compara o que o leitor vê, o
  // percentual já arredondado, e não o número cru.
  let predominantSentence: string | null = null;
  if (present.length > 0) {
    const top = Math.max(...present.map((item) => item.percentage));
    const tied = present.filter(
      (item) => percent(item.percentage) === percent(top),
    );
    const notYetCited = tied.filter((item) => !mentioned.has(item.id));

    if (tied.length === 1) {
      // Uma pior classe que também é a maior ganha só o complemento na frase
      // dela; sozinha, não tem com quem competir e a frase dela basta.
      if (worstSentence && notYetCited.length === 0 && present.length > 1) {
        worstSentence = `${worstSentence.slice(0, -1)}, sendo também a classe predominante.`;
      } else if (notYetCited.length === 1) {
        predominantSentence = `a classe de seca predominante é a ${tied[0].name}, presente em ${percent(top)} da área.`;
      }
    } else if (notYetCited.length > 0) {
      const alreadyCited = tied.find((item) => mentioned.has(item.id));
      predominantSentence =
        notYetCited.length === 1 && alreadyCited
          ? `a ${notYetCited[0].name} também corresponde a ${percent(top)} da área, o mesmo percentual observado na ${alreadyCited.name} citada acima.`
          : `${joinWithAnd(
              notYetCited.map(
                (item) => `a ${item.name} (${percent(item.percentage)})`,
              ),
            )} correspondem ao mesmo percentual da área cada.`;
    }
    notYetCited.forEach(({ id }) => mentioned.add(id));
  }

  if (worstSentence) sentences.push(sentence(worstSentence));
  if (predominantSentence) sentences.push(sentence(predominantSentence));

  // 3. O restante.
  const remaining = present.filter((item) => !mentioned.has(item.id));
  if (remaining.length === 1) {
    sentences.push(
      `A classe restante, ${remaining[0].name}, corresponde a ${percent(remaining[0].percentage)} da área.`,
    );
  } else if (remaining.length > 1) {
    const sum = remaining.reduce((total, item) => total + item.percentage, 0);
    sentences.push(`As demais classes somam ${percent(sum)} da área.`);
  }

  return sentences.join(" ");
}
