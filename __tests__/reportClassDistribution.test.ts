import { describe, expect, it } from "vitest";
import en from "@/translations/en/MunicipalReport.json";
import es from "@/translations/es/MunicipalReport.json";
import pt from "@/translations/pt/MunicipalReport.json";
import { describeClassDistribution } from "@/utils/reportClassDistribution";

/** As classes na ordem da legenda, com o percentual do período. */
function shares(entries: ReadonlyArray<[label: string, percentage: number]>) {
  return entries.map(([label, percentage], index) => ({
    id: `classe-${index}`,
    label,
    percentage,
  }));
}

const MONITOR_SEVERITY = {
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

const MONITOR_LABELS = [
  "Sem seca",
  "Seca fraca",
  "Seca moderada",
  "Seca grave",
  "Seca extrema",
  "Seca excepcional",
];

function monitor(...percentages: number[]) {
  return shares(
    MONITOR_LABELS.map((label, index) => [label, percentages[index] ?? 0]),
  );
}

/** O `t` do next-intl para um idioma, só com as chaves desta frase. */
function translator(messages: {
  MunicipalReport: { distribution: Record<string, string> };
}) {
  return (key: string, values: Record<string, string> = {}) => {
    const template =
      messages.MunicipalReport.distribution[key.replace(/^distribution\./, "")];
    return template.replace(
      /\{(\w+)\}/g,
      (_, name: string) => values[name] ?? "",
    );
  };
}

describe("describeClassDistribution", () => {
  // Monitor de Secas, Brasil, janeiro de 2026: a frase de hoje dizia só
  // "predomina Sem seca (35,10%)".
  it("abre pelo total pior que a classe normal e segue a ordem de gravidade", () => {
    expect(
      describeClassDistribution(
        monitor(35.1, 31.9, 18.4, 10, 4.6),
        MONITOR_SEVERITY,
        "pt-BR",
      ),
    ).toBe(
      "64,90% da área está em classes piores que Sem seca: Seca fraca (31,90%), Seca moderada (18,40%), Seca grave (10,00%) e Seca extrema (4,60%); o restante (35,10%) está em Sem seca",
    );
  });

  it("não deixa a classe grave pequena sumir quando a leve é a maior", () => {
    expect(
      describeClassDistribution(
        monitor(10, 50, 0, 0, 40),
        MONITOR_SEVERITY,
        "pt-BR",
      ),
    ).toBe(
      "90,00% da área está em classes piores que Sem seca: Seca fraca (50,00%) e Seca extrema (40,00%); o restante (10,00%) está em Sem seca",
    );
  });

  // São João d'Aliança (GO), julho de 2026: com empate, a frase de hoje
  // escolhia a primeira classe da legenda como "predominante".
  it("cita as duas classes de um empate", () => {
    expect(
      describeClassDistribution(monitor(0, 50, 50), MONITOR_SEVERITY, "pt-BR"),
    ).toBe(
      "toda a área está em classes piores que Sem seca: Seca fraca (50,00%) e Seca moderada (50,00%)",
    );
  });

  // Cerrado, junho de 2026: Seca grave com 0,20% entra no total, mas não na lista.
  it("conta a classe abaixo de 1% no total sem citá-la", () => {
    expect(
      describeClassDistribution(
        monitor(40.3, 37.7, 21.8, 0.2),
        MONITOR_SEVERITY,
        "pt-BR",
      ),
    ).toBe(
      "59,70% da área está em classes piores que Sem seca: Seca fraca (37,70%) e Seca moderada (21,80%); o restante (40,30%) está em Sem seca",
    );
  });

  it("usa o singular quando só uma classe pior aparece", () => {
    expect(
      describeClassDistribution(
        monitor(91.7, 0, 0, 8.3),
        MONITOR_SEVERITY,
        "pt-BR",
      ),
    ).toBe(
      "8,30% da área está na classe Seca grave, pior que Sem seca; o restante (91,70%) está em Sem seca",
    );
  });

  it("volta à lista por área quando o pior que o normal não chega a 1%", () => {
    expect(
      describeClassDistribution(monitor(99.6, 0.4), MONITOR_SEVERITY, "pt-BR"),
    ).toBe("a classe Sem seca ocupa 99,60% da área");
    expect(
      describeClassDistribution(monitor(100), MONITOR_SEVERITY, "pt-BR"),
    ).toBe("toda a área está na classe Sem seca");
  });

  it("separa as classes melhores quando a classe normal fica no meio da escala", () => {
    const degradation = shares([
      ["Degradando", 6.6],
      ["Estável", 90.8],
      ["Melhorando", 2.6],
    ]);

    expect(
      describeClassDistribution(
        degradation,
        {
          order: ["classe-2", "classe-1", "classe-0"],
          neutralClassId: "classe-1",
        },
        "pt-BR",
      ),
    ).toBe(
      "6,60% da área está na classe Degradando, pior que Estável; 90,80% está em Estável e 2,60% em Melhorando",
    );
  });

  it("com mais de quatro classes piores, cita as três mais graves", () => {
    expect(
      describeClassDistribution(
        monitor(10, 30, 20, 20, 15, 5),
        MONITOR_SEVERITY,
        "pt-BR",
      ),
    ).toBe(
      "90,00% da área está em classes piores que Sem seca: Seca grave (20,00%), Seca extrema (15,00%) e Seca excepcional (5,00%); as demais classes piores somam 50,00%; o restante (10,00%) está em Sem seca",
    );
  });

  // Solos do Brasil, Brasil: 11 das 17 classes passam de 1%.
  it("sem ordem de gravidade, cita as três maiores e soma o resto", () => {
    const soils = shares([
      ["Outros", 0],
      ["Áreas Urbanas e Massa d'água", 2.4],
      ["Argissolo", 30.4],
      ["Cambissolo", 5.6],
      ["Espodossolo", 1.9],
      ["Gleissolo", 4.2],
      ["Latossolo", 32.5],
      ["Luvissolo", 2.8],
      ["Neossolo", 11.9],
      ["Nitossolo", 1.1],
      ["Planossolo", 2.1],
      ["Plintossolo", 4.3],
      ["Vertissolo", 0.2],
      ["Organossolo", 0.1],
      ["Dunas", 0.1],
      ["Chernossolo", 0.3],
      ["Afloramentos Rochosos", 0.2],
    ]);

    expect(describeClassDistribution(soils, undefined, "pt-BR")).toBe(
      "a área se divide entre Latossolo (32,50%), Argissolo (30,40%) e Neossolo (11,90%), e as demais classes somam 25,30%",
    );
  });

  // Índice de Aridez, Semiárido, 2024: com quatro classes, nenhuma vira "demais".
  it("cita as quatro classes em vez de esconder uma em 'as demais'", () => {
    const aridity = shares([
      ["Árido", 1.5],
      ["Semiárido", 53.9],
      ["Subúmido Seco", 22.6],
      ["Úmido", 21.9],
    ]);

    expect(describeClassDistribution(aridity, undefined, "pt-BR")).toBe(
      "a área se divide entre Semiárido (53,90%), Subúmido Seco (22,60%), Úmido (21,90%) e Árido (1,50%)",
    );
  });

  it("não fala do resto quando ele não chega a 1%", () => {
    const dynamics = shares([
      ["Degradando", 7.9],
      ["Estável", 91.6],
      ["Melhorando", 0.5],
    ]);

    expect(describeClassDistribution(dynamics, undefined, "pt-BR")).toBe(
      "a área se divide entre Estável (91,60%) e Degradando (7,90%)",
    );
  });

  it("devolve null quando o período veio zerado", () => {
    expect(
      describeClassDistribution(monitor(), MONITOR_SEVERITY, "pt-BR"),
    ).toBeNull();
  });

  it("a tradução em português é a mesma frase que o servidor monta", () => {
    const distribution = monitor(35.1, 31.9, 18.4, 10, 4.6);

    expect(
      describeClassDistribution(
        distribution,
        MONITOR_SEVERITY,
        "pt-BR",
        translator(pt),
      ),
    ).toBe(describeClassDistribution(distribution, MONITOR_SEVERITY, "pt-BR"));
  });

  it("monta a lista com a conjunção de cada idioma", () => {
    const distribution = monitor(35.1, 31.9, 18.4, 10, 4.6);
    const labels: Record<string, string> = {
      "Sem seca": "No drought",
      "Seca fraca": "Weak drought",
      "Seca moderada": "Moderate drought",
      "Seca grave": "Severe drought",
      "Seca extrema": "Extreme drought",
    };

    expect(
      describeClassDistribution(
        distribution,
        MONITOR_SEVERITY,
        "en",
        translator(en),
        (label) => labels[label] ?? label,
      ),
    ).toBe(
      "64.90% of the area is in classes worse than No drought: Weak drought (31.90%), Moderate drought (18.40%), Severe drought (10.00%), and Extreme drought (4.60%); the remaining 35.10% is in No drought",
    );
    expect(
      describeClassDistribution(
        shares([
          ["Semiárido", 53.9],
          ["Úmido", 46.1],
        ]),
        undefined,
        "es",
        translator(es),
      ),
    ).toBe("el área se reparte entre Semiárido (53,90%) y Úmido (46,10%)");
  });
});
