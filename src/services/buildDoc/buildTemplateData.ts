import "server-only";

import { getMunicipalReportPresentation } from "@/config/municipalReport";
import { buildMunicipalReport } from "@/services/municipalReportService";
import type {
  MunicipalReportData,
  MunicipalReportDistributionItem,
  MunicipalReportPeriodSnapshot,
} from "@/contracts/municipalReport";
import type { TimingObserver } from "@/utils/serverTiming";

export interface TemplateData {
  [key: string]: string | number | null | undefined;
}

const SECA_ANALYSIS_ID = "anaseca";
const ARIDEZ_ANALYSIS_ID = "indicearidez";
const DEGRADACAO_ANALYSIS_ID = "deg";
const REPORT_LOCALE = "pt-BR";

function getAnalysis(report: MunicipalReportData, analysisId: string) {
  return report.analyses.find((analysis) => analysis.id === analysisId);
}

function getAnalysisTimeSeries(report: MunicipalReportData, analysisId: string): MunicipalReportPeriodSnapshot[] {
  const analysis = getAnalysis(report, analysisId);
  if (!analysis?.effectivePeriod) return [];

  return analysis.timeSeries.filter((snapshot) => snapshot.period <= analysis.effectivePeriod!);
}

function getLatestSnapshot(timeSeries: MunicipalReportPeriodSnapshot[]): MunicipalReportPeriodSnapshot | undefined {
  const series = timeSeries.filter((snapshot) => snapshot.dominantClass);
  return series.length > 0 ? series[series.length - 1] : undefined;
}

function getDistributionPercentage(snapshot: MunicipalReportPeriodSnapshot | undefined, classId: string): number {
  return snapshot?.distribution.find((item) => item.id === classId)?.percentage ?? 0;
}

function formatPeriod(period: string) {
  const match = /^(\d{4})-(\d{2})$/u.exec(period);
  if (!match) return period;

  return new Intl.DateTimeFormat(REPORT_LOCALE, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1)));
}

function formatClassLabel(label: string) {
  const normalized = label.trim();
  if (!normalized) return label;

  return `${normalized.charAt(0).toLocaleUpperCase(REPORT_LOCALE)}${normalized.slice(1).toLocaleLowerCase(REPORT_LOCALE)}`;
}

function formatClass(id: string, label: string) {
  const presentation = getMunicipalReportPresentation(SECA_ANALYSIS_ID);
  const code = presentation.history?.classes[id]?.code ?? presentation.classes?.[id]?.code;
  const classLabel = formatClassLabel(label);

  return code ? `${classLabel} (${code})` : classLabel;
}

function computarVariaveisSeca(timeSeries: MunicipalReportPeriodSnapshot[]): Record<string, string | number> {
  const series = timeSeries.filter((snapshot) => snapshot.dominantClass);
  if (series.length === 0) return {};

  const totalMeses = series.length;
  const ultimoMes = series[totalMeses - 1];
  const penultimoMes = series[totalMeses - 2];

  const ultimos12 = series.slice(Math.max(totalMeses - 12, 0));

  const qtd_meses_com_seca = ultimos12.filter((m) => m.dominantClass!.id !== "sem-seca").length;
  const mes_ano_inicio_tendencia = formatPeriod(ultimos12[0].period);

  const pesosSeca: Record<string, number> = {
    "sem-seca": 0,
    "seca-fraca": 1,
    "seca-moderada": 2,
    "seca-grave": 3,
    "seca-extrema": 4,
    "seca-excepcional": 5,
  };

  const pesoAtual = pesosSeca[ultimoMes.dominantClass!.id] ?? 0;
  const pesoAnterior = penultimoMes ? (pesosSeca[penultimoMes.dominantClass!.id] ?? 0) : 0;

  let status_tendencia_seca = "mantendo";
  if (pesoAtual > pesoAnterior) status_tendencia_seca = "agravando";
  if (pesoAtual < pesoAnterior) status_tendencia_seca = "amenizando";

  const ano_inicio_historico = formatPeriod(series[0].period);
  const ano_fim_historico = formatPeriod(ultimoMes.period);

  const freqClasses: Record<string, { count: number; label: string }> = {};
  let maxPesoObservado = -1;
  let classeSecaMaxima = "Sem seca";
  let idClasseMaxima = "sem-seca";

  series.forEach((m) => {
    const id = m.dominantClass!.id;
    const label = m.dominantClass!.label;

    if (!freqClasses[id]) freqClasses[id] = { count: 0, label };
    freqClasses[id].count++;

    const peso = pesosSeca[id] ?? 0;
    if (peso > maxPesoObservado) {
      maxPesoObservado = peso;
      classeSecaMaxima = label;
      idClasseMaxima = id;
    }
  });

  let classeMaisFrequente = "";
  let idClasseMaisFrequente = "";
  let countMaisFrequente = 0;
  for (const [id, dados] of Object.entries(freqClasses)) {
    if (dados.count > countMaisFrequente) {
      countMaisFrequente = dados.count;
      classeMaisFrequente = dados.label;
      idClasseMaisFrequente = id;
    }
  }

  const mesesSecaMaxima = series.filter((m) => m.dominantClass!.id === idClasseMaxima).map((m) => m.period);
  const periodos_seca_maxima =
    mesesSecaMaxima.length > 0
      ? mesesSecaMaxima.slice(-3).map(formatPeriod).join(", ") + (mesesSecaMaxima.length > 3 ? " (entre outros)" : "")
      : "nenhum";
  return {
    qtd_meses_com_seca,
    mes_ano_inicio_tendencia,
    status_tendencia_seca,
    classe_seca_anterior: penultimoMes ? formatClass(penultimoMes.dominantClass!.id, penultimoMes.dominantClass!.label) : "Sem dados",
    ano_inicio_historico,
    ano_fim_historico,
    classe_seca_mais_frequente: formatClass(idClasseMaisFrequente, classeMaisFrequente),
    percentual_freq_seca: Number(((countMaisFrequente / totalMeses) * 100).toFixed(1)),
    percentual_sem_seca: Number((((freqClasses["sem-seca"]?.count ?? 0) / totalMeses) * 100).toFixed(1)),
    classe_seca_maxima: formatClass(idClasseMaxima, classeSecaMaxima),
    periodos_seca_maxima,
  };
}

function computarVariaveisAridez(timeSeries: MunicipalReportPeriodSnapshot[]): Record<string, string | number> {
  const series = timeSeries.filter((snapshot) => snapshot.dominantClass);
  if (series.length === 0) return {};

  const primeira = series[0];
  const ultima = series[series.length - 1];

  const pesosAridez: Record<string, number> = {
    umido: 0,
    "subumido-seco": 1,
    semiarido: 2,
    arido: 3,
  };

  const pesoIni = pesosAridez[primeira.dominantClass!.id] ?? 0;
  const pesoFim = pesosAridez[ultima.dominantClass!.id] ?? 0;

  let tendencia = "estabilidade";
  if (pesoFim > pesoIni || ultima.dominantClass!.percentage > primeira.dominantClass!.percentage) {
    tendencia = "aridificação";
  } else if (pesoFim < pesoIni) {
    tendencia = "amenização";
  }

  return {
    periodo_aridez_inicial: primeira.period,
    percentual_aridez_inicial: primeira.dominantClass!.percentage,
    status_tendencia_aridez: tendencia,
  };
}

function computarVariaveisDegradacao(timeSeries: MunicipalReportPeriodSnapshot[]): Record<string, string | number> {
  const series = timeSeries.filter((snapshot) => snapshot.dominantClass);
  if (series.length < 2) return {};

  const inicial = series[0];
  const final = series[series.length - 1];

  const getPct = (snapshot: MunicipalReportPeriodSnapshot, id: string) =>
    snapshot.distribution.find((d) => d.id === id)?.percentage ?? 0;

  const pctCons = getPct(final, "conservado");
  const pctN1 = getPct(final, "nivel-1");
  const pctN2 = getPct(final, "nivel-2");
  const pctN3 = getPct(final, "nivel-3");
  const pctN4 = getPct(final, "nivel-4");
  const pctN5 = getPct(final, "nivel-5");

  let status_tendencia_degradacao = "estabilidade";
  const degradacaoInicial = getPct(inicial, "nivel-3") + getPct(inicial, "nivel-4") + getPct(inicial, "nivel-5");
  const degradacaoFinal = pctN3 + pctN4 + pctN5;

  if (degradacaoFinal > degradacaoInicial + 1) status_tendencia_degradacao = "aumento";
  if (degradacaoFinal < degradacaoInicial - 1) status_tendencia_degradacao = "redução";

  let maxDiff = 0;
  let classeMaiorVariacao = "";
  let acrescimoDecrescimo = "acréscimo";

  final.distribution.forEach((classeFinal: MunicipalReportDistributionItem) => {
    const pInicial = getPct(inicial, classeFinal.id);
    const diff = classeFinal.percentage - pInicial;

    if (Math.abs(diff) > maxDiff) {
      maxDiff = Math.abs(diff);
      classeMaiorVariacao = classeFinal.label;
      acrescimoDecrescimo = diff > 0 ? "acréscimo" : "decréscimo";
    }
  });

  return {
    percentual_deg_conservado: pctCons,
    percentual_deg_n1: pctN1,
    percentual_deg_n2: pctN2,
    percentual_deg_n3: pctN3,
    percentual_deg_n4: pctN4,
    percentual_deg_n5: pctN5,
    periodo_degradacao_inicial: inicial.period,
    status_tendencia_degradacao,
    classe_maior_variacao_deg: classeMaiorVariacao,
    acrescimo_decrescimo_deg: acrescimoDecrescimo,
    variacao_deg_pontos: Number(maxDiff.toFixed(1)),
    compatibilidade_com_seca: status_tendencia_degradacao === "aumento" ? "é" : "não é totalmente",
    relacao_seca_degradacao_texto:
      status_tendencia_degradacao === "aumento"
        ? "o déficit hídrico prolongado acelera a perda de cobertura vegetal"
        : "outros fatores de manejo do solo podem estar freando a degradação física",
  };
}

export function prepareTemplateData(report: MunicipalReportData): TemplateData {
  const secaSeries = getAnalysisTimeSeries(report, SECA_ANALYSIS_ID);
  const aridezSeries = getAnalysisTimeSeries(report, ARIDEZ_ANALYSIS_ID);
  const degSeries = getAnalysisTimeSeries(report, DEGRADACAO_ANALYSIS_ID);

  const ultimoSeca = getAnalysis(report, SECA_ANALYSIS_ID)?.snapshot ?? getLatestSnapshot(secaSeries);
  const ultimoAridez = getAnalysis(report, ARIDEZ_ANALYSIS_ID)?.snapshot ?? getLatestSnapshot(aridezSeries);
  const ultimoDeg = getAnalysis(report, DEGRADACAO_ANALYSIS_ID)?.snapshot ?? getLatestSnapshot(degSeries);

  const varsSeca = computarVariaveisSeca(secaSeries);
  const varsAridez = computarVariaveisAridez(aridezSeries);
  const varsDeg = computarVariaveisDegradacao(degSeries);

  const grauRisco = varsDeg.status_tendencia_degradacao === "aumento" ? "elevado" : "moderado";

  const soma_percentual_deg_n3_n4_n5 = Number(
    (getDistributionPercentage(ultimoDeg, "nivel-3") +
      getDistributionPercentage(ultimoDeg, "nivel-4") +
      getDistributionPercentage(ultimoDeg, "nivel-5")).toFixed(2),
  );

  return {
    municipio: report.municipality.name,
    uf: report.municipality.uf,
    data_geracao: new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(
      new Date(report.generatedAt),
    ),
    periodo_referencia: formatPeriod(report.requestedPeriod),

    classe_seca: ultimoSeca?.dominantClass ? formatClass(ultimoSeca.dominantClass.id, ultimoSeca.dominantClass.label) : "Sem dados",
    percentual_seca: ultimoSeca?.dominantClass?.percentage ?? 0,
    periodo_seca: ultimoSeca?.period ? formatPeriod(ultimoSeca.period) : "Sem dados",

    classe_aridez: ultimoAridez?.dominantClass?.label ?? "Sem dados",
    percentual_aridez: ultimoAridez?.dominantClass?.percentage ?? 0,
    periodo_aridez: ultimoAridez?.period ?? "Sem dados",

    classe_degradacao: ultimoDeg?.dominantClass?.label ?? "Sem dados",
    percentual_degradacao: ultimoDeg?.dominantClass?.percentage ?? 0,
    periodo_degradacao: ultimoDeg?.period ?? "Sem dados",

    soma_percentual_deg_n3_n4_n5,

    ...varsSeca,
    ...varsAridez,
    ...varsDeg,

    texto_resumo_seca: `Seca ${ultimoSeca?.dominantClass?.label.toLowerCase() ?? "ativa"} prolongada`,
    texto_resumo_aridez: `enquadramento integral nas ASDs (${ultimoAridez?.dominantClass?.percentage}% ${ultimoAridez?.dominantClass?.label})`,
    texto_resumo_degradacao: "presença acentuada de degradação da terra",
    grau_exposicao_desertificacao: grauRisco,
  };
}



export async function getTemplateData(
  ibgeId: string,
  period: string,
  onTiming?: TimingObserver,
): Promise<TemplateData> {
  const report = await buildMunicipalReport(ibgeId, period, { onTiming });
  const templateData = prepareTemplateData(report);

  return { ...report.templateVariables, ...templateData };
}
