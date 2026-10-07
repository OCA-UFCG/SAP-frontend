import { describe, expect, it } from "vitest";
import {
  MUNICIPALITY_KEY_PATTERN,
  shouldIncludeLocation,
} from "@/utils/statisticsLocationScope";

describe("shouldIncludeLocation", () => {
  it("leva as UFs junto com o Brasil, que é de onde sai o ranking de estados", () => {
    expect(shouldIncludeLocation("br", "br")).toBe(true);
    expect(shouldIncludeLocation("br", "pb")).toBe(true);
  });

  it("não leva município nem recorte espacial no pedido nacional", () => {
    expect(shouldIncludeLocation("br", "2507507")).toBe(false);
    expect(shouldIncludeLocation("br", "3_bioma-caatinga")).toBe(false);
  });

  it("responde só a própria linha em qualquer outro recorte", () => {
    expect(shouldIncludeLocation("pb", "pb")).toBe(true);
    expect(shouldIncludeLocation("pb", "br")).toBe(false);
    expect(shouldIncludeLocation("pb", "2507507")).toBe(false);
    expect(shouldIncludeLocation("2507507", "2507507")).toBe(true);
  });
});

describe("MUNICIPALITY_KEY_PATTERN", () => {
  it("reconhece o código IBGE de sete dígitos e mais nada", () => {
    expect(MUNICIPALITY_KEY_PATTERN.test("2507507")).toBe(true);
    // A UF tem duas letras e o código de UF do IBGE dois dígitos: nenhum dos
    // dois pode ser confundido com município, senão a leitura filtraria a
    // tabela por um código que não existe e devolveria o território vazio.
    expect(MUNICIPALITY_KEY_PATTERN.test("25")).toBe(false);
    expect(MUNICIPALITY_KEY_PATTERN.test("pb")).toBe(false);
    expect(MUNICIPALITY_KEY_PATTERN.test("25075070")).toBe(false);
  });
});
