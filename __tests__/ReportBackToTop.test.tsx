import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, within } from "@testing-library/react";
import { ReportBackToTop } from "@/components/MunicipalReport/ReportBackToTop";

const pendingFrames: FrameRequestCallback[] = [];

function stubAnimationFrames() {
  pendingFrames.length = 0;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    pendingFrames.push(callback);
    return pendingFrames.length;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {
    pendingFrames.length = 0;
  });
}

function runFrame(timestamp: number) {
  const frame = pendingFrames.shift();
  frame?.(timestamp);
}

function renderInScrollingReport({ scrollable = true } = {}) {
  const viewport = document.createElement("div");
  viewport.style.overflowY = scrollable ? "auto" : "visible";
  Object.defineProperty(viewport, "scrollHeight", {
    value: 2000,
    configurable: true,
  });
  Object.defineProperty(viewport, "clientHeight", {
    value: 600,
    configurable: true,
  });
  viewport.scrollTop = 800;
  document.body.appendChild(viewport);

  const mount = document.createElement("div");
  viewport.appendChild(mount);

  render(<ReportBackToTop />, { container: mount });

  return { link: within(mount).getByRole("link"), viewport };
}

describe("ReportBackToTop", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    document.body.replaceChildren();
  });

  it("anima a volta ao topo do relatório, sem mexer na janela", () => {
    stubAnimationFrames();
    const { link, viewport } = renderInScrollingReport();

    const clicked = fireEvent.click(link);

    expect(clicked).toBe(false);

    runFrame(0);
    expect(viewport.scrollTop).toBe(800);

    runFrame(250);
    expect(viewport.scrollTop).toBeLessThan(800);
    expect(viewport.scrollTop).toBeGreaterThan(0);

    runFrame(5000);
    expect(viewport.scrollTop).toBe(0);
  });

  it("deixa a âncora nativa agir quando o relatório não tem caixa rolável", () => {
    stubAnimationFrames();
    const { link } = renderInScrollingReport({ scrollable: false });

    expect(fireEvent.click(link)).toBe(true);
    expect(pendingFrames).toHaveLength(0);
  });
});
