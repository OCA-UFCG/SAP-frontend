import { afterEach, describe, expect, it, vi } from "vitest";
import { runSectionTransition } from "@/components/PlatformSidebar/sectionTransition";

type StartViewTransition = (update: () => void) => {
  ready: Promise<void>;
  finished: Promise<void>;
};

function stubViewTransitions() {
  const calls: Array<{ phase: string | undefined }> = [];
  const start: StartViewTransition = (update) => {
    calls.push({ phase: document.documentElement.dataset.sectionTransition });
    update();
    return { ready: Promise.resolve(), finished: new Promise(() => {}) };
  };
  Object.defineProperty(document, "startViewTransition", {
    configurable: true,
    value: start,
  });
  return calls;
}

function stubReducedMotion(reduce: boolean) {
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({ matches: reduce && query.includes("reduce") }) as MediaQueryList,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  delete (document as { startViewTransition?: unknown }).startViewTransition;
  delete document.documentElement.dataset.sectionTransition;
});

describe("runSectionTransition", () => {
  it("troca na hora quando o navegador não tem View Transitions", () => {
    stubReducedMotion(false);
    const commit = vi.fn();

    runSectionTransition("monitoring", "analysis", commit);

    expect(commit).toHaveBeenCalledTimes(1);
    expect(document.documentElement.dataset.sectionTransition).toBeUndefined();
  });

  it("troca sem animar para quem pediu menos movimento", () => {
    stubReducedMotion(true);
    const calls = stubViewTransitions();
    const commit = vi.fn();

    runSectionTransition("monitoring", "communication", commit);

    expect(commit).toHaveBeenCalledTimes(1);
    expect(calls).toHaveLength(0);
  });

  it("encolhe o mapa só entre Monitoramento e Priorização", () => {
    stubReducedMotion(false);
    const calls = stubViewTransitions();

    runSectionTransition("monitoring", "analysis", vi.fn());
    runSectionTransition("analysis", "monitoring", vi.fn());
    runSectionTransition("monitoring", "communication", vi.fn());

    expect(calls.map((call) => call.phase)).toEqual(["shrink", "grow", "land"]);
  });

  it("não anima quando a seção é a mesma", () => {
    stubReducedMotion(false);
    const calls = stubViewTransitions();
    const commit = vi.fn();

    runSectionTransition("monitoring", "monitoring", commit);

    expect(commit).toHaveBeenCalledTimes(1);
    expect(calls).toHaveLength(0);
  });
});
