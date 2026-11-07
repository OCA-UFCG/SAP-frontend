import { describe, expect, it } from "vitest";
import {
  localizeFields,
  translatedFieldNames,
} from "@/repositories/content/localizedFields";

describe("localizeFields", () => {
  const banner = {
    title: "Comece pelo lugar onde você vive",
    titleEn: "Start with the place where you live",
    titleEs: "   ",
    link: "/platform",
  };

  it("troca o texto pelo do idioma e tira os campos de tradução", () => {
    expect(localizeFields(banner, ["title"], "en")).toEqual({
      title: "Start with the place where you live",
      link: "/platform",
    });
  });

  it("fica com o português quando a tradução está em branco", () => {
    expect(localizeFields(banner, ["title"], "es").title).toBe(
      "Comece pelo lugar onde você vive",
    );
  });

  it("em português só tira os campos de tradução", () => {
    expect(localizeFields(banner, ["title"], "pt")).toEqual({
      title: "Comece pelo lugar onde você vive",
      link: "/platform",
    });
  });
});

describe("translatedFieldNames", () => {
  it("lista os campos de inglês e espanhol para a query", () => {
    expect(translatedFieldNames(["term", "definition"])).toBe(
      "termEn\ntermEs\ndefinitionEn\ndefinitionEs",
    );
  });
});
