import { describe, expect, it } from "vitest";

import {
  getReportTerritoryForSelection,
  isReportTerritoryKeyShape,
  resolveReportTerritory,
} from "@/utils/reportTerritory";

describe("resolveReportTerritory", () => {
  it("resolve o município pelo código IBGE, com a UF no rótulo", () => {
    expect(resolveReportTerritory("2504009")).toMatchObject({
      level: "municipality",
      name: "Campina Grande",
      label: "Campina Grande — PB",
      uf: "PB",
      municipalityCode: "2504009",
      prepositionalLabel: "No município de Campina Grande — PB",
    });
  });

  it("resolve os recortes agregados pela chave que o Earth Engine conhece", () => {
    expect(resolveReportTerritory("br")?.label).toBe("Brasil");
    expect(resolveReportTerritory("ba")?.label).toBe("Bahia");
    expect(resolveReportTerritory("2_regiao-nordeste")?.label).toBe("Nordeste");
    expect(resolveReportTerritory("3_bioma-caatinga")?.label).toBe("Caatinga");
    expect(resolveReportTerritory("4_asd-asd-entorno")?.level).toBe("asd");
    expect(resolveReportTerritory("5_semiarido-semiarido-total")?.level).toBe(
      "semiarid",
    );
  });

  // A contração depende do gênero do recorte e do artigo do nome, e é
  // justamente o que quem escreve o texto no catálogo não tem como acertar:
  // o mesmo texto é lido em todos os recortes.
  it("escreve a preposição certa para cada recorte", () => {
    const prepositional = (key: string) =>
      resolveReportTerritory(key)?.prepositionalLabel;

    expect(prepositional("br")).toBe("No Brasil");
    expect(prepositional("ba")).toBe("No estado da Bahia");
    expect(prepositional("sp")).toBe("No estado de São Paulo");
    expect(prepositional("pa")).toBe("No estado do Pará");
    expect(prepositional("2_regiao-nordeste")).toBe("Na região Nordeste");
    expect(prepositional("3_bioma-caatinga")).toBe("No bioma Caatinga");
    expect(prepositional("4_asd-asd-entorno")).toBe("Nas ASD e Entorno");
    expect(prepositional("5_semiarido-semiarido-total")).toBe("No Semiárido");
  });

  it("escreve a forma possessiva, para o meio da frase", () => {
    expect(resolveReportTerritory("2504009")?.possessiveLabel).toBe(
      "do município de Campina Grande — PB",
    );
    expect(resolveReportTerritory("2_regiao-sul")?.possessiveLabel).toBe(
      "da região Sul",
    );
    expect(resolveReportTerritory("br")?.possessiveLabel).toBe("do Brasil");
  });

  it("devolve null para uma chave que não descreve nenhum território", () => {
    expect(resolveReportTerritory("9999999")).toBeNull();
    expect(resolveReportTerritory("xx")).toBeNull();
    expect(resolveReportTerritory("3_bioma-inexistente")).toBeNull();
    expect(resolveReportTerritory("")).toBeNull();
  });
});

describe("isReportTerritoryKeyShape", () => {
  // A rota separa os dois casos: forma inválida é 400, território inexistente
  // é 404 — como era quando a rota só aceitava município.
  it("aceita a forma de uma chave, mesmo sem o território existir", () => {
    expect(isReportTerritoryKeyShape("9999999")).toBe(true);
    expect(isReportTerritoryKeyShape("3_bioma-inexistente")).toBe(true);
  });

  it("recusa o que não tem forma de chave territorial", () => {
    expect(isReportTerritoryKeyShape("../secret")).toBe(false);
    expect(isReportTerritoryKeyShape("250400")).toBe(false);
    expect(isReportTerritoryKeyShape("")).toBe(false);
  });
});

describe("getReportTerritoryForSelection", () => {
  it("traduz a seleção do painel de Monitoramento em território do relatório", () => {
    expect(
      getReportTerritoryForSelection({
        spatialArea: "state",
        spatialValue: "Paraíba",
      }),
    ).toMatchObject({ locationKey: "pb", label: "Paraíba" });
  });
});
