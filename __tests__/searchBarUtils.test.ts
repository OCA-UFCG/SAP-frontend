import { describe, expect, it } from "vitest";
import { filterSearchOptions } from "@/components/SearchBar/searchBarUtils";

describe("filterSearchOptions", () => {
  // "ce" começa "Ceará" e "Centro-Oeste" do mesmo jeito, mas quem digita a
  // sigla quer o estado.
  it("puts the state first when its UF is typed", () => {
    expect(filterSearchOptions("ce")[0]).toBe("Ceará");
    expect(filterSearchOptions("CE")[0]).toBe("Ceará");
  });

  it("keeps a region first when its name is typed", () => {
    expect(filterSearchOptions("centro")[0]).toBe("Centro-Oeste");
  });
});
