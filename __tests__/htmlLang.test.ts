import { describe, expect, it } from "vitest";
import { htmlLang } from "@/translations/htmlLang";

describe("htmlLang", () => {
  it("marks Portuguese as Brazilian Portuguese", () => {
    expect(htmlLang("pt")).toBe("pt-BR");
  });

  it("keeps the other locales as they are", () => {
    expect(htmlLang("en")).toBe("en");
    expect(htmlLang("es")).toBe("es");
  });
});
