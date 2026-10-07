import { describe, expect, it } from "vitest";

import type { MunicipalReportPeriodSnapshot } from "@/contracts/municipalReport";
import {
  computeReportSeriesVariables,
  describeReportSeriesVariables,
  REPORT_SERIES_NO_DATA,
} from "@/utils/reportSeriesVariables";
import type { ReportVariableProfile } from "@/utils/reportVariableProfile";

const SEVERITY = {
  order: ["sem-seca", "seca-fraca", "seca-moderada"],
  neutralClassId: "sem-seca",
};

const LABELS: Record<string, string> = {
  "sem-seca": "Sem seca",
  "seca-fraca": "Seca fraca",
  "seca-moderada": "Seca moderada",
};

/** Um período com a classe dominante em `percentage` e o resto dividido. */
function snapshot(
  period: string,
  classId: string,
  percentage: number,
): MunicipalReportPeriodSnapshot {
  const distribution = Object.keys(LABELS).map((id) => ({
    id,
    label: LABELS[id],
    color: "#000000",
    percentage: id === classId ? percentage : (100 - percentage) / 2,
  }));

  return {
    period,
    label: period,
    distribution,
    dominantClass: distribution.find((item) => item.id === classId)!,
  };
}

function profile(
  overrides: Partial<ReportVariableProfile> = {},
): ReportVariableProfile {
  return {
    granularity: "month",
    periodCount: 24,
    shape: "class-distribution",
    nature: "historical",
    ...overrides,
  };
}

describe("describeReportSeriesVariables", () => {
  it("não oferece a janela de 12 meses a um índice anual", () => {
    const tokens = describeReportSeriesVariables(
      profile({ granularity: "year", periodCount: 5 }),
    ).map(({ token }) => token);

    expect(tokens).toContain("[periodo_anterior]");
    expect(tokens).not.toContain("[janela_12_meses]");
    expect(tokens).not.toContain("[classe_mesmo_mes_ano_anterior]");
  });

  it("exige mais de doze períodos mensais para comparar com o ano anterior", () => {
    const tokens = describeReportSeriesVariables(
      profile({ periodCount: 12 }),
    ).map(({ token }) => token);

    expect(tokens).not.toContain("[janela_12_meses]");
  });

  it("só oferece tendência e severidade quando a ordem foi declarada", () => {
    const semOrdem = describeReportSeriesVariables(profile()).map(
      ({ token }) => token,
    );
    const comOrdem = describeReportSeriesVariables(
      profile({ severity: SEVERITY }),
    ).map(({ token }) => token);

    expect(semOrdem).not.toContain("[status_tendencia]");
    expect(comOrdem).toContain("[status_tendencia]");
    expect(comOrdem).toContain("[classe_maior_severidade]");
  });

  it("condiciona a contagem de períodos fora do normal à classe neutra", () => {
    const tokens = describeReportSeriesVariables(
      profile({ severity: { order: SEVERITY.order } }),
    ).map(({ token }) => token);

    expect(tokens).toContain("[status_tendencia]");
    expect(tokens).not.toContain("[quantidade_periodos_com_fenomeno]");
  });

  it("troca as variáveis de classe pelas de valor num indicador de valor único", () => {
    const tokens = describeReportSeriesVariables(
      profile({ shape: "municipal-value" }),
    ).map(({ token }) => token);

    expect(tokens).toContain("[valor_anterior]");
    expect(tokens).toContain("[diferenca_valor]");
    expect(tokens).not.toContain("[classe_mais_frequente]");
  });

  it("não oferece nenhuma variável de série a um índice de previsão", () => {
    expect(
      describeReportSeriesVariables(profile({ nature: "forecast" })),
    ).toEqual([]);
  });

  it("não oferece nada quando a série tem um período só", () => {
    expect(
      describeReportSeriesVariables(
        profile({ granularity: "year", periodCount: 1 }),
      ),
    ).toEqual([]);
  });
});

describe("computeReportSeriesVariables", () => {
  const series = [
    snapshot("2024-01", "sem-seca", 80),
    snapshot("2024-02", "seca-fraca", 60),
    snapshot("2024-03", "seca-moderada", 70),
  ];

  it("descreve o período anterior e a variação da classe atual", () => {
    const values = computeReportSeriesVariables(
      series,
      profile({ granularity: "month", periodCount: 3 }),
    );

    expect(values.periodo_anterior).toBe("fevereiro de 2024");
    expect(values.classe_anterior).toBe("Seca fraca");
    expect(values.percentual_anterior).toBe(60);
    // A classe atual tinha 20% em fevereiro ((100 - 60) / 2) e tem 70% agora.
    expect(values.variacao_pontos).toBe(50);
    expect(values.acrescimo_decrescimo).toBe("acréscimo");
  });

  it("conta a classe mais frequente e o alcance da série", () => {
    const repetida = [...series, snapshot("2024-04", "seca-moderada", 55)];
    const values = computeReportSeriesVariables(
      repetida,
      profile({ periodCount: 4 }),
    );

    expect(values.quantidade_periodos).toBe(4);
    expect(values.periodo_inicial).toBe("janeiro de 2024");
    expect(values.periodo_final).toBe("abril de 2024");
    expect(values.classe_mais_frequente).toBe("Seca moderada");
    expect(values.percentual_freq).toBe(50);
    expect(values.quantidade_periodos_na_classe).toBe(2);
  });

  it("classifica a tendência pela ordem de gravidade declarada", () => {
    const agravando = computeReportSeriesVariables(
      series,
      profile({ periodCount: 3, severity: SEVERITY }),
    );
    const amenizando = computeReportSeriesVariables(
      [...series, snapshot("2024-04", "sem-seca", 90)],
      profile({ periodCount: 4, severity: SEVERITY }),
    );

    expect(agravando.status_tendencia).toBe("agravando");
    expect(amenizando.status_tendencia).toBe("amenizando");
    expect(agravando.classe_maior_severidade).toBe("Seca moderada");
    expect(agravando.periodo_maior_severidade).toBe("março de 2024");
    expect(agravando.quantidade_periodos_com_fenomeno).toBe(2);
    expect(agravando.percentual_condicao_neutra).toBeCloseTo(33.3, 1);
  });

  it("compara com o mesmo mês do ano anterior numa série longa", () => {
    const longa = [
      snapshot("2023-03", "sem-seca", 90),
      ...Array.from({ length: 11 }, (_, index) =>
        snapshot(`2023-${String(index + 4).padStart(2, "0")}`, "sem-seca", 88),
      ),
      snapshot("2024-03", "seca-moderada", 70),
    ];
    const values = computeReportSeriesVariables(
      longa,
      profile({ periodCount: 13 }),
    );

    expect(values.classe_mesmo_mes_ano_anterior).toBe("Sem seca");
    expect(values.janela_12_meses).toBe("abril de 2023 a março de 2024");
    // Em março de 2023 a classe atual valia 5% ((100 - 90) / 2).
    expect(values.variacao_ano_a_ano).toBe(65);
  });

  it("devolve “sem dados” em vez de deixar o colchete escapar para o relatório", () => {
    const values = computeReportSeriesVariables(
      [snapshot("2024-03", "seca-moderada", 70)],
      profile({ periodCount: 4 }),
    );

    expect(Object.keys(values)).toContain("classe_anterior");
    expect(values.classe_anterior).toBe(REPORT_SERIES_NO_DATA);
    expect(values.periodo_anterior).toBe(REPORT_SERIES_NO_DATA);
  });

  it("devolve exatamente as chaves que o índice comporta", () => {
    const indexProfile = profile({ granularity: "year", periodCount: 3 });
    const offered = describeReportSeriesVariables(indexProfile).map(
      ({ key }) => key,
    );

    expect(
      Object.keys(computeReportSeriesVariables(series, indexProfile)).sort(),
    ).toEqual(offered.sort());
  });

  it("não calcula nada para um índice de previsão", () => {
    expect(
      computeReportSeriesVariables(series, profile({ nature: "forecast" })),
    ).toEqual({});
  });
});
