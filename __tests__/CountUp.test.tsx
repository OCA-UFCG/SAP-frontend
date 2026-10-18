import { act } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CountUp } from "@/components/HomeMotion/HomeMotion";

// O número ainda fora da tela: o observador nunca avisa.
class IdleObserver {
  observe() {}
  disconnect() {}
}

/** Monta como na página real: HTML do servidor e depois a hidratação. */
async function hydrateAt(nowMs: number) {
  const container = document.createElement("div");
  container.innerHTML = renderToString(<CountUp value="5.570" />);
  document.body.appendChild(container);
  const serverHtml = container.innerHTML;

  vi.stubGlobal("IntersectionObserver", IdleObserver);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.spyOn(performance, "now").mockReturnValue(nowMs);
  await act(async () => {
    hydrateRoot(container, <CountUp value="5.570" />);
  });
  return { container, serverHtml };
}

const visibleNumber = (container: HTMLElement) =>
  container.querySelector("[aria-hidden]")!;

describe("CountUp", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("ships the real number in the server HTML, hidden until the page decides", async () => {
    const { serverHtml } = await hydrateAt(300);

    expect(serverHtml).toContain("5.570");
    expect(serverHtml).toContain("count-up-pending");
  });

  it("counts from 0 when the page becomes interactive quickly", async () => {
    const { container } = await hydrateAt(300);

    expect(visibleNumber(container)).toHaveTextContent("0");
    expect(visibleNumber(container)).not.toHaveClass("count-up-pending");
  });

  it("keeps the real number when the page took too long, instead of going back to 0", async () => {
    const { container } = await hydrateAt(3500);

    expect(visibleNumber(container)).toHaveTextContent("5.570");
    expect(visibleNumber(container)).not.toHaveClass("count-up-pending");
  });
});
