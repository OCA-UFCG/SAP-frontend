import { describe, expect, it } from "vitest";

import { rankingLevelsByInterestArea } from "@/utils/amfeConsts";

describe("rankingLevelsByInterestArea", () => {
  it("exposes the ranking granularities valid for every interest area", () => {
    expect(rankingLevelsByInterestArea).toEqual({
      national: ["national", "region", "biome", "state"],
      region: ["region", "biome", "state"],
      biome: ["biome", "state"],
      state: ["state"],
      semiarid: ["national", "state"],
      asd: ["national", "state"],
    });
  });
});
