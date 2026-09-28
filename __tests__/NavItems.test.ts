import { describe, expect, it } from "vitest";
import { shouldPrefetchFullRoute } from "@/components/NavItems/NavItems";

describe("shouldPrefetchFullRoute", () => {
  it("prefetches the whole platform so its code is ready before the click", () => {
    expect(shouldPrefetchFullRoute("/platform")).toBe(true);
  });

  it("keeps Next's default prefetch for the other menu entries", () => {
    expect(shouldPrefetchFullRoute("/glossary")).toBeUndefined();
    expect(
      shouldPrefetchFullRoute("/#plano-de-acao-brasileiro"),
    ).toBeUndefined();
    expect(shouldPrefetchFullRoute(undefined)).toBeUndefined();
  });
});
