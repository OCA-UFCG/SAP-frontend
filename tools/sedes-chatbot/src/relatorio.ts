import { semAcento } from "./texto.ts";

/**
 * Resume a resposta de /api/municipal-report/{chave}?period=… para a IA.
 *
 * O JSON inteiro passa de 900 KB (o CDI decendial sozinho traz ~900 períodos),
 * então só sai o que responde perguntas: classe predominante, classes com
 * área, período efetivo e, se pedido, os últimos períodos de um índice.
 */
interface Distribuicao {
  label: string;
  percentage: number;
}
interface Analise {
  id: string;
  title: string;
  unit?: string;
  valueType?: string;
  status: string;
  requestedPeriod?: string;
  effectivePeriod?: string | null;
  forecast?: unknown;
  snapshot?: { period: string; distribution: Distribuicao[] } | null;
  timeSeries?: Array<{ period: string; distribution: Distribuicao[] }>;
}
interface Relatorio {
  generatedAt: string;
  requestedPeriod: string;
  territory: { label: string; kindLabel: string };
  analyses: Analise[];
}

function fmt(n: number) {
  return Number(n.toFixed(1)).toLocaleString("pt-BR");
}

function distribuicao(d: Distribuicao[], analise: Analise) {
  if (analise.valueType === "absolute") {
    return d
      .map((x) => `${fmt(x.percentage)} ${analise.unit ?? ""}`.trim())
      .join("; ");
  }
  const com = d
    .filter((x) => x.percentage > 0)
    .sort((a, b) => b.percentage - a.percentage);
  if (!com.length) return "sem área em nenhuma classe";
  if (d.length === 1) return `${fmt(com[0].percentage)}%`;
  return com.map((x) => `${x.label}: ${fmt(x.percentage)}%`).join("; ");
}

/** "Produto Interno Bruto" vira "pib"; "Índice de Desenvolvimento Humano", "idh". */
function sigla(titulo: string) {
  return semAcento(titulo.split(/[|:(]/)[0])
    .split(" ")
    .filter((p) => p && !["de", "da", "do", "das", "dos", "e"].includes(p))
    .map((p) => p[0])
    .join("");
}

export function resumirRelatorio(r: Relatorio, filtro?: string, ultimos = 12) {
  const termo = filtro ? semAcento(filtro) : "";
  const analises = r.analyses.filter(
    (a) =>
      !a.id.startsWith("teste-") &&
      (!termo ||
        semAcento(a.id).includes(termo) ||
        semAcento(a.title).includes(termo) ||
        sigla(a.title) === termo.replace(/ /g, "")),
  );
  const linhas = [
    `Relatório do site para ${r.territory.label} (${r.territory.kindLabel}), período pedido ${r.requestedPeriod}.`,
    `Calculado agora pelo Earth Engine em ${r.generatedAt}. Valores em % são % da área do território, salvo indicação.`,
    "",
  ];
  if (!analises.length) {
    linhas.push(
      filtro
        ? `Nenhum índice do relatório corresponde a "${filtro}". Índices disponíveis: ${r.analyses.map((a) => a.id).join(", ")}`
        : "O relatório não trouxe nenhum índice.",
    );
    return linhas.join("\n");
  }
  for (const a of analises) {
    const prev = a.forecast ? " [PREVISÃO]" : "";
    if (a.status !== "available" || !a.snapshot) {
      linhas.push(
        `- ${a.title} (${a.id})${prev}: ${a.status === "period_not_found" ? "sem dado para o período pedido" : "indisponível"}.`,
      );
      continue;
    }
    const n = a.timeSeries?.length ?? 0;
    const serie = n
      ? ` Série: ${n} períodos, de ${a.timeSeries![0].period} a ${a.timeSeries![n - 1].period}.`
      : "";
    const outro =
      a.effectivePeriod && a.effectivePeriod !== r.requestedPeriod
        ? ` (período mais próximo disponível: ${a.effectivePeriod})`
        : "";
    linhas.push(
      `- ${a.title} (${a.id})${prev}, período ${a.snapshot.period}${outro}: ${distribuicao(a.snapshot.distribution, a)}.${serie}`,
    );
    if (filtro && n) {
      for (const s of a.timeSeries!.slice(-ultimos)) {
        linhas.push(`    ${s.period}: ${distribuicao(s.distribution, a)}`);
      }
    }
  }
  return linhas.join("\n");
}
