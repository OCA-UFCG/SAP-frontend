import { describe, expect, it } from "vitest";

import {
  BRAZIL_TERRITORY_CODE,
  resolveNextSelectedState,
} from "@/components/Map/stateSelection";

describe("resolveNextSelectedState", () => {
  it("selects the clicked state when it differs from the current territory", () => {
    expect(resolveNextSelectedState(BRAZIL_TERRITORY_CODE, "sp")).toBe("SP");
    expect(resolveNextSelectedState("MG", "sp")).toBe("SP");
  });

  it("toggles back to Brazil when clicking the selected state", () => {
    expect(resolveNextSelectedState("SP", "SP")).toBe(BRAZIL_TERRITORY_CODE);
    expect(resolveNextSelectedState("sp", " SP ")).toBe(BRAZIL_TERRITORY_CODE);
  });
});
