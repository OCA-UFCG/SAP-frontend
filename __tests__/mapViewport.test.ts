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

  it("reserves the bottom strip the phone controls cover, keeping some map free", () => {
    expect(
      buildOverlayAwareMapPadding({
        containerWidth: 390,
        containerHeight: 534,
        bottomOverlayHeight: 176,
      }),
    ).toEqual({ top: 0, right: 0, bottom: 176, left: 0 });

    // Num mapa baixo a legenda não pode tomar tudo: sobram 160px livres.
    expect(
      buildOverlayAwareMapPadding({
        containerWidth: 390,
        containerHeight: 300,
        bottomOverlayHeight: 250,
      }).bottom,
    ).toBe(140);
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

  // No celular a trilha vira a barra de baixo e o painel cobre o mapa inteiro:
  // descontar a largura deles empurrava o Brasil para a borda da tela.
  it("não desconta trilha nem painel no celular", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: true }) as unknown as MediaQueryList),
    );
    document.body.innerHTML = `
      <div data-platform-side-rail></div>
      <div data-platform-side-panel></div>
    `;
    mockElementWidth(
      document.querySelector<HTMLElement>("[data-platform-side-rail]")!,
      390,
    );
    mockElementWidth(
      document.querySelector<HTMLElement>("[data-platform-side-panel]")!,
      390,
    );

    expect(resolvePlatformSidebarOverlayWidth(document)).toBe(0);
    vi.unstubAllGlobals();
  });
});

