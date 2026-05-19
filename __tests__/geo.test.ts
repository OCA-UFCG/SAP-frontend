import { describe, expect, it, vi } from "vitest";

vi.mock("@/data/citiesIndex.json", () => ({
  default: [
    {
      code: "2504009",
      label: "Campina Grande - PB",
      name: "Campina Grande",
      uf: "pb",
    },
  ],
}));

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

  it("matches a municipality label to its state", () => {
    expect(resolveStateKeyFromSearch("Campina Grande - PB", statesObj)).toEqual(
      {
        type: "city",
        key: "pb",
        city: {
          code: "2504009",
          label: "Campina Grande - PB",
          name: "Campina Grande",
          uf: "pb",
        },
      },
    );
  });
});
