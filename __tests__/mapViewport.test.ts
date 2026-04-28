import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildOverlayAwareMapPadding,
  buildOverlayAwareFitBoundsPadding,
  MAP_FIT_BOUNDS_BASE_PADDING,
  resolvePlatformSidebarOverlayWidth,
} from "@/components/Map/mapViewport";

function mockElementWidth(element: HTMLElement, width: number) {
  Object.defineProperty(element, "getBoundingClientRect", {
    configurable: true,
    value: vi.fn(() => ({ width })),
  });
}

describe("buildOverlayAwareFitBoundsPadding", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

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
      left: MAP_FIT_BOUNDS_BASE_PADDING,
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
      left: 48,
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

  it("uses the sidebar width as persistent map padding", () => {
    expect(
      buildOverlayAwareMapPadding({
        leftOverlayWidth: 544,
        containerWidth: 1400,
      }),
    ).toEqual({
      top: 0,
      right: 0,
      bottom: 0,
      left: 544,
    });
  });

  it("explicitly sums the side rail and panel widths", () => {
    document.body.innerHTML = `
      <aside data-platform-sidebar-overlay>
        <div data-platform-side-rail></div>
        <div data-platform-side-panel></div>
      </aside>
    `;

    const sideRail = document.querySelector(
      "[data-platform-side-rail]",
    ) as HTMLElement;
    const sidePanel = document.querySelector(
      "[data-platform-side-panel]",
    ) as HTMLElement;

    mockElementWidth(sideRail, 140);
    mockElementWidth(sidePanel, 420);

    expect(resolvePlatformSidebarOverlayWidth(document)).toBe(560);
  });

  it("falls back to the sidebar overlay width when explicit sections are absent", () => {
    document.body.innerHTML = `<aside data-platform-sidebar-overlay></aside>`;

    const overlay = document.querySelector(
      "[data-platform-sidebar-overlay]",
    ) as HTMLElement;

    mockElementWidth(overlay, 560);

    expect(resolvePlatformSidebarOverlayWidth(document)).toBe(560);
  });
});
