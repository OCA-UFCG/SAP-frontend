import { describe, expect, it } from "vitest";
import { filterSearchOptions } from "@/components/SearchBar/searchBarUtils";
import { searchMatchRank } from "@/utils/searchMatch";

describe("searchMatchRank", () => {
  it("põe o nome exato antes do começo do nome, e este antes do meio", () => {
    expect(searchMatchRank("patos", ["patos", "patos-pb"])).toBe(0);
    expect(searchMatchRank("patos", ["patosdeminas"])).toBe(1);
    expect(searchMatchRank("patos", ["lagoadospatos"])).toBe(2);
    expect(searchMatchRank("patos", ["sousa"])).toBeNull();
  });
});

describe("filterSearchOptions", () => {
  // O Enter do Monitoramento escolhe a primeira sugestão.
  it("sugere primeiro o município de nome exato, mesmo digitado sem acento", () => {
    expect(filterSearchOptions("joao pessoa")[0]).toBe("João Pessoa - PB");
    expect(filterSearchOptions("Patos")[0]).toBe("Patos - PB");
  });

  it("sugere primeiro o estado de nome exato", () => {
    expect(filterSearchOptions("para")[0]).toBe("Pará");
  });
});
