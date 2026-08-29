import { describe, expect, it } from "vitest";

import { chunk } from "@/utils/chunk";

describe("chunk", () => {
  it("divide preservando a ordem e devolve o resto no último bloco", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("devolve um bloco só quando cabe tudo", () => {
    expect(chunk(["a", "b"], 15)).toEqual([["a", "b"]]);
  });

  it("devolve lista vazia para entrada vazia", () => {
    expect(chunk([], 10)).toEqual([]);
  });
});
