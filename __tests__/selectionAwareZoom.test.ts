import { describe, expect, it, vi } from "vitest";
import {
  getSelectionAwareScrollZoomOptions,
  shouldZoomAroundSelectedState,
  syncSelectionAwareScrollZoom,
} from "@/components/Map/selectionAwareZoom";

describe("selectionAwareZoom", () => {
  it("keeps cursor-based zoom when no state is selected", () => {
    expect(shouldZoomAroundSelectedState("BR")).toBe(false);
    expect(getSelectionAwareScrollZoomOptions("BR")).toBe(true);
  });

  it("switches to centered zoom when a state is selected", () => {
    expect(shouldZoomAroundSelectedState("GO")).toBe(true);
    expect(getSelectionAwareScrollZoomOptions("GO")).toEqual({
      around: "center",
    });
  });

  it("reconfigures the scroll zoom handler when selection changes", () => {
    const disable = vi.fn();
    const enable = vi.fn();

    syncSelectionAwareScrollZoom(
      {
        disable,
        enable,
      },
      "GO",
    );

    expect(disable).toHaveBeenCalledTimes(1);
    expect(enable).toHaveBeenCalledWith({ around: "center" });

    disable.mockClear();
    enable.mockClear();

    syncSelectionAwareScrollZoom(
      {
        disable,
        enable,
      },
      "BR",
    );

    expect(disable).toHaveBeenCalledTimes(1);
    expect(enable).toHaveBeenCalledWith();
  });
});
