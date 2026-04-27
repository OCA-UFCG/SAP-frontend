import { describe, expect, it } from "vitest";
import {
  buildOverlayAwareFitBoundsPadding,
  MAP_FIT_BOUNDS_BASE_PADDING,
} from "@/components/Map/mapViewport";

describe("buildOverlayAwareFitBoundsPadding", () => {
  it("adds the sidebar width to the left padding when there is enough room", () => {
    expect(
      buildOverlayAwareFitBoundsPadding({
        leftOverlayWidth: 544,
        containerWidth: 1400,
      }),
    ).toEqual({
      top: MAP_FIT_BOUNDS_BASE_PADDING,
      right: MAP_FIT_BOUNDS_BASE_PADDING,
      bottom: MAP_FIT_BOUNDS_BASE_PADDING,
      left: MAP_FIT_BOUNDS_BASE_PADDING + 544,
    });
  });

  it("shrinks the generic fit padding before reducing sidebar compensation", () => {
    expect(
      buildOverlayAwareFitBoundsPadding({
        leftOverlayWidth: 544,
        containerWidth: 800,
      }),
    ).toEqual({
      top: 48,
      right: 48,
      bottom: 48,
      left: 592,
    });
  });

  it("ignores negative overlay widths", () => {
    expect(
      buildOverlayAwareFitBoundsPadding({
        leftOverlayWidth: -124,
      }),
    ).toEqual({
      top: MAP_FIT_BOUNDS_BASE_PADDING,
      right: MAP_FIT_BOUNDS_BASE_PADDING,
      bottom: MAP_FIT_BOUNDS_BASE_PADDING,
      left: MAP_FIT_BOUNDS_BASE_PADDING,
    });
  });
});