import { describe, expect, it } from "vitest";

import en from "@/translations/en/AnalysisPanel.json";
import enReport from "@/translations/en/MunicipalReport.json";
import es from "@/translations/es/AnalysisPanel.json";
import esReport from "@/translations/es/MunicipalReport.json";
import { localizeReportTerritory } from "@/utils/localizeReportTerritory";
import { resolveReportTerritory } from "@/utils/reportTerritory";

function translator(messages: object) {
  return (key: string) =>
    key
      .split(".")
      .reduce<unknown>(
        (node, part) => (node as Record<string, unknown>)?.[part],
        messages,
      ) as string;
}

const tPanel = {
  en: translator(en.AnalysisPanel),
  es: translator(es.AnalysisPanel),
};
const tReport = {
  en: translator(enReport.MunicipalReport),
  es: translator(esReport.MunicipalReport),
};

function localize(key: string, locale: "en" | "es") {
  return localizeReportTerritory(
    resolveReportTerritory(key)!,
    locale,
    tPanel[locale],
    tReport[locale],
  );
}

describe("localizeReportTerritory", () => {
  // O inglês já escreve "In {place}": a forma "No município de…" do servidor
  // virava "In No município de Campina Grande — PB".
  it("tira a preposição do português fora do pt", () => {
    expect(localize("2504009", "en")).toMatchObject({
      label: "Campina Grande — PB",
      prepositionalLabel: "Campina Grande — PB",
      possessiveLabel: "Campina Grande — PB",
      kindLabel: "municipality",
    });
  });

  it("traduz o nome dos recortes agregados", () => {
    expect(localize("br", "en").label).toBe("Brazil");
    expect(localize("3_bioma-mata-atlantica", "en").label).toBe(
      "Atlantic Forest",
    );
    expect(localize("3_bioma-mata-atlantica", "es").label).toBe(
      "Mata Atlántica",
    );
  });

  it("mantém nome e chave originais, que o mapa e o arquivo usam", () => {
    const territory = localize("br", "en");
    expect(territory.name).toBe("Brasil");
    expect(territory.locationKey).toBe("br");
  });

  it("devolve o território do servidor em português", () => {
    const territory = resolveReportTerritory("3_bioma-caatinga")!;
    expect(
      localizeReportTerritory(territory, "pt", tPanel.en, tReport.en),
    ).toBe(territory);
  });
});
