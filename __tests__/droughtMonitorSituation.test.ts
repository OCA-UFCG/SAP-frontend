import { describe, expect, it } from "vitest";

import { buildDroughtMonitorSituation } from "@/utils/droughtMonitorSituation";

const SEVERITY = {
  order: ["classe-0", "classe-1", "classe-2", "classe-3", "classe-4", "classe-5"],
  neutralClassId: "classe-0",
};

const LABELS = [
  "Sem seca",
  "Seca fraca",
  "Seca moderada",
  "Seca grave",
  "Seca extrema",
  "Seca excepcional",
];

/** Percentuais na ordem da escala: Sem seca, D0, D1, D2, D3, D4. */
function distribution(...percentages: number[]) {
  return LABELS.map((label, index) => ({
    id: `classe-${index}`,
    label,
    color: "#000000",
    percentage: percentages[index] ?? 0,
  }));
}

function situation(...percentages: number[]) {
  return buildDroughtMonitorSituation(
    "No Brasil",
    distribution(...percentages),
    SEVERITY,
  );
}

describe("buildDroughtMonitorSituation", () => {
  it("abre pelo total em seca quando a classe maior é Sem seca (Brasil, jan/2026)", () => {
    expect(situation(35.1, 31.9, 18.4, 10, 4.6, 0)).toBe(
      "No Brasil, 35,10% da área está sem seca e 64,90% em algum nível de seca. " +
        "Observam-se como piores classes a Seca extrema (D3), presente em 4,60% da área, " +
        "e a Seca grave (D2), presente em 10,00% da área. " +
        "A classe de seca predominante é a Seca fraca (D0), presente em 31,90% da área. " +
        "A classe restante, Seca moderada (D1), corresponde a 18,40% da área.",
    );
  });

  it("destaca a pior classe e funde com a predominante quando são a mesma", () => {
    expect(situation(20, 10, 15, 55)).toBe(
      "No Brasil, 20,00% da área está sem seca e 80,00% em algum nível de seca. " +
        "Observa-se como pior classe a Seca grave (D2), presente em 55,00% da área, " +
        "sendo também a classe de seca predominante. " +
        "As demais classes, Seca moderada (D1) e Seca fraca (D0), somam 25,00% da área.",
    );
  });

  it("não chama de predominante a única classe de seca presente (Paragominas)", () => {
    expect(situation(35.9, 64.1)).toBe(
      "No Brasil, 35,90% da área está sem seca e 64,10% em algum nível de seca. " +
        "A seca presente é a Seca fraca (D0), em 64,10% da área.",
    );
  });

  it("cita as duas classes num empate em vez de escolher a primeira da legenda", () => {
    expect(situation(0, 50, 50)).toBe(
      "No Brasil, toda a área está em algum nível de seca. " +
        "A Seca moderada (D1) e a Seca fraca (D0) são as classes de seca predominantes, com 50,00% da área cada.",
    );
  });

  it("compara o empate com a pior classe já citada", () => {
    expect(situation(40, 10, 25, 25)).toBe(
      "No Brasil, 40,00% da área está sem seca e 60,00% em algum nível de seca. " +
        "Observa-se como pior classe a Seca grave (D2), presente em 25,00% da área. " +
        "A Seca moderada (D1) também corresponde a 25,00% da área, o mesmo percentual da Seca grave (D2) citada acima. " +
        "A classe restante, Seca fraca (D0), corresponde a 10,00% da área.",
    );
  });

  it("resume quando quase toda a área está sem seca", () => {
    expect(situation(97, 2, 1)).toBe(
      "No Brasil, 97,00% da área está sem seca. " +
        "Os 3,00% restantes distribuem-se entre Seca moderada (D1), com 1,00%, e Seca fraca (D0), com 2,00%.",
    );
    expect(situation(98, 2)).toBe(
      "No Brasil, 98,00% da área está sem seca. Os 2,00% restantes correspondem à Seca fraca (D0).",
    );
  });

  it("diz que não há seca quando nenhuma classe passa de 0,5%", () => {
    expect(situation(99.7, 0.3)).toBe(
      "No Brasil, toda a área está sem seca (99,70%), sem nenhuma classe de seca observada no período.",
    );
  });

  it("diz que toda a área está numa classe quando ela ocupa tudo", () => {
    expect(situation(0, 0, 0, 0, 100)).toBe(
      "No Brasil, toda a área está em Seca extrema (D3).",
    );
  });

  it("não cita a classe de borda, mas a soma no total em seca", () => {
    expect(situation(59.6, 40, 0, 0, 0, 0.4)).toBe(
      "No Brasil, 59,60% da área está sem seca e 40,40% em algum nível de seca. " +
        "A seca presente é a Seca fraca (D0), em 40,00% da área.",
    );
  });

  it("fecha a abertura em 100% mesmo quando a fonte soma 100,1% (Paraíba, jul/2026)", () => {
    expect(situation(13.9, 35.4, 50.8)).toMatch(
      /^No Brasil, 13,90% da área está sem seca e 86,10% em algum nível de seca\./,
    );
  });

  it("não resolve sem classe neutra na escala", () => {
    expect(
      buildDroughtMonitorSituation("No Brasil", distribution(50, 50), {
        order: SEVERITY.order,
      }),
    ).toBeNull();
    expect(
      buildDroughtMonitorSituation("No Brasil", distribution(50, 50), undefined),
    ).toBeNull();
  });
});
