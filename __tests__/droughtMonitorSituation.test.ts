import { describe, expect, it } from "vitest";

import { buildDroughtMonitorSituation } from "@/utils/droughtMonitorSituation";

const SEVERITY = {
  order: [
    "classe-0",
    "classe-1",
    "classe-2",
    "classe-3",
    "classe-4",
    "classe-5",
  ],
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
  it("abre por Sem seca e destaca as piores classes (Brasil, jan/2026)", () => {
    expect(situation(35.1, 31.9, 18.4, 10, 4.6, 0)).toBe(
      "No Brasil, 35,10% da área está sem seca. " +
        "Observam-se como piores classes a Seca extrema (D3), presente em 4,60% da área, " +
        "e a Seca grave (D2), presente em 10,00% da área. " +
        "A classe de seca predominante é a Seca fraca (D0), presente em 31,90% da área. " +
        "A classe restante, Seca moderada (D1), corresponde a 18,40% da área.",
    );
  });

  it("não repete em seca o que já disse sem seca (Nordeste)", () => {
    expect(situation(2.9, 48.3, 30.1, 15.2, 3.5)).not.toMatch(/97,10%/);
  });

  it("começa pelas piores classes quando não há área sem seca (Campina Grande, set/2026)", () => {
    expect(situation(0, 0, 95.6, 4.4)).toBe(
      "No Brasil, observa-se como pior classe a Seca grave (D2), presente em 4,40% da área. " +
        "A classe de seca predominante é a Seca moderada (D1), presente em 95,60% da área.",
    );
  });

  it("funde a pior classe com a predominante quando são a mesma", () => {
    expect(situation(20, 10, 15, 55)).toBe(
      "No Brasil, 20,00% da área está sem seca. " +
        "Observa-se como pior classe a Seca grave (D2), presente em 55,00% da área, " +
        "sendo também a classe predominante. " +
        "As demais classes somam 25,00% da área.",
    );
  });

  it("chama de predominante mesmo a única classe de seca (Paragominas)", () => {
    expect(situation(35.9, 64.1)).toBe(
      "No Brasil, 35,90% da área está sem seca. " +
        "A classe de seca predominante é a Seca fraca (D0), presente em 64,10% da área.",
    );
  });

  it("cita a única classe de seca só uma vez quando ela é uma das piores", () => {
    expect(situation(0, 0, 0, 0, 100)).toBe(
      "No Brasil, observa-se como pior classe a Seca extrema (D3), presente em 100,00% da área.",
    );
  });

  it("cita as duas classes num empate em vez de escolher a primeira da legenda", () => {
    expect(situation(0, 50, 50)).toBe(
      "No Brasil, a Seca moderada (D1) (50,00%) e a Seca fraca (D0) (50,00%) " +
        "correspondem ao mesmo percentual da área cada.",
    );
  });

  it("compara o empate com a pior classe já citada", () => {
    expect(situation(40, 10, 25, 25)).toBe(
      "No Brasil, 40,00% da área está sem seca. " +
        "Observa-se como pior classe a Seca grave (D2), presente em 25,00% da área. " +
        "A Seca moderada (D1) também corresponde a 25,00% da área, o mesmo percentual observado na Seca grave (D2) citada acima. " +
        "A classe restante, Seca fraca (D0), corresponde a 10,00% da área.",
    );
  });

  it("resume quando quase toda a área está sem seca", () => {
    expect(situation(97, 2, 1)).toBe(
      "No Brasil, 97,00% da área está sem seca. " +
        "Os 3,00% restantes distribuem-se entre Seca moderada (D1) (1,00%) e Seca fraca (D0) (2,00%).",
    );
    expect(situation(98, 2)).toBe(
      "No Brasil, 98,00% da área está sem seca. Os 2,00% restantes correspondem à Seca fraca (D0).",
    );
    expect(situation(98, 0.4, 0.4, 0.4, 0.4, 0.4)).toBe(
      "No Brasil, 98,00% da área está sem seca.",
    );
  });

  it("diz que não há seca quando Sem seca passa de 99,5%", () => {
    expect(situation(99.7, 0.3)).toBe(
      "No Brasil, toda a área está sem seca (99,70%), sem nenhuma classe de seca observada no período.",
    );
  });

  it("não cita a classe de borda, mas a soma no total em seca", () => {
    expect(situation(96, 3.6, 0, 0, 0, 0.4)).toBe(
      "No Brasil, 96,00% da área está sem seca. Os 4,00% restantes correspondem à Seca fraca (D0).",
    );
  });

  it("não resolve sem classe neutra na escala", () => {
    expect(
      buildDroughtMonitorSituation("No Brasil", distribution(50, 50), {
        order: SEVERITY.order,
      }),
    ).toBeNull();
    expect(
      buildDroughtMonitorSituation(
        "No Brasil",
        distribution(50, 50),
        undefined,
      ),
    ).toBeNull();
  });
});
