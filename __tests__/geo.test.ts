import { describe, expect, it } from "vitest";

import { resolveStateKeyFromSearch } from "@/lib/geo";

const statesObj = {
  sp: "São Paulo",
  rj: "Rio de Janeiro",
  ce: "Ceará",
};

describe("geo shared module", () => {
  it("matches a UF directly", () => {
    expect(resolveStateKeyFromSearch("sp", statesObj)).toEqual({
      type: "uf",
      key: "sp",
    });
  });

  it("matches a state name using normalized accents and spacing", () => {
    expect(resolveStateKeyFromSearch("  sao paulo  ", statesObj)).toEqual({
      type: "uf",
      key: "sp",
    });
    expect(resolveStateKeyFromSearch("CEARA", statesObj)).toEqual({
      type: "uf",
      key: "ce",
    });
  });

  it("falls back to Brazil when the state is unknown", () => {
    expect(resolveStateKeyFromSearch("desconhecido", statesObj)).toEqual({
      type: "br",
      key: "br",
    });
  });
});
