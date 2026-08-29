import { describe, expect, it } from "vitest";

import { HEX_COLOR_PATTERN, normalizeHexColor } from "@/utils/hexColor";

describe("normalizeHexColor", () => {
  it("normaliza para maiúsculas mantendo o #", () => {
    expect(normalizeHexColor("#ca281b")).toBe("#CA281B");
  });

  it("aceita o valor sem # e com espaços, que é como ele costuma ser colado", () => {
    expect(normalizeHexColor("  ca281b ")).toBe("#CA281B");
  });

  it("expande a abreviação de três dígitos do CSS", () => {
    expect(normalizeHexColor("fff")).toBe("#FFFFFF");
    expect(normalizeHexColor("#0a3")).toBe("#00AA33");
  });

  it("recusa comprimentos que não são 3 nem 6 dígitos", () => {
    expect(normalizeHexColor("#12345")).toBeNull();
    expect(normalizeHexColor("#1234567")).toBeNull();
    expect(normalizeHexColor("")).toBeNull();
  });

  it("recusa caracteres que não são hexadecimais", () => {
    expect(normalizeHexColor("#gggggg")).toBeNull();
    expect(normalizeHexColor("rgb(1,2,3)")).toBeNull();
  });

  it("devolve sempre algo que o validador do rascunho aceita", () => {
    for (const entrada of ["fff", "#ca281b", " 640E08 ", "#0a3"]) {
      const normalizado = normalizeHexColor(entrada);
      expect(normalizado).not.toBeNull();
      expect(HEX_COLOR_PATTERN.test(normalizado as string)).toBe(true);
    }
  });
});
