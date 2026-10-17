import { describe, expect, it } from "vitest";

import { isTileLayerReadyEvent } from "@/components/Map/tileLayerLoading";

describe("isTileLayerReadyEvent", () => {
  it("waits while tiles of the view are still arriving", () => {
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
    ).toBe(false);
  });

  it("accepts the tile event that completes the view", () => {
    expect(
      isTileLayerReadyEvent(
        {
          sourceId: "gee-tiles",
          sourceDataType: "content",
          isSourceLoaded: true,
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
