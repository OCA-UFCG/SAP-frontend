import { describe, expect, it } from "vitest";

import { isTileLayerReadyEvent } from "@/components/Map/tileLayerLoading";

describe("isTileLayerReadyEvent", () => {
  it("accepts the first tile-backed event for the target source", () => {
    expect(
      isTileLayerReadyEvent(
        {
          sourceId: "gee-tiles",
          sourceDataType: "content",
          isSourceLoaded: false,
          tile: { id: "0/0/0" },
        },
        "gee-tiles",
      ),
    ).toBe(true);
  });

  it("keeps idle as a source-loaded fallback", () => {
    expect(
      isTileLayerReadyEvent(
        {
          sourceId: "gee-tiles",
          sourceDataType: "idle",
          isSourceLoaded: true,
          tile: undefined,
        },
        "gee-tiles",
      ),
    ).toBe(true);
  });

  it("ignores source events that are still only metadata", () => {
    expect(
      isTileLayerReadyEvent(
        {
          sourceId: "gee-tiles",
          sourceDataType: "metadata",
          isSourceLoaded: true,
          tile: undefined,
        },
        "gee-tiles",
      ),
    ).toBe(false);
  });

  it("ignores tile events from another source", () => {
    expect(
      isTileLayerReadyEvent(
        {
          sourceId: "state-tiles",
          sourceDataType: "content",
          isSourceLoaded: false,
          tile: { id: "0/0/0" },
        },
        "gee-tiles",
      ),
    ).toBe(false);
  });
});
