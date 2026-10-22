import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import {
  startVLibrasWidget,
  VLIBRAS_APP_URL,
  VLIBRAS_SCRIPT_URL,
} from "@/lib/vlibras";

/** Faz o papel do `window.VLibras` que o plugin do governo cria ao carregar. */
class FakeVLibrasWidget {
  static rootPaths: string[] = [];

  constructor(rootPath: string) {
    FakeVLibrasWidget.rootPaths.push(rootPath);
  }
}

/** Guarda as props que o `next/script` recebeu, sem carregar nada da rede. */
class FakeScriptRecorder {
  static last: {
    src?: string;
    strategy?: string;
    onLoad?: () => void;
  } | null = null;
}

vi.mock("next/script", () => ({
  default: (props: typeof FakeScriptRecorder.last) => {
    FakeScriptRecorder.last = props;
    return null;
  },
}));

describe("startVLibrasWidget", () => {
  it("starts the widget with the government app folder", () => {
    FakeVLibrasWidget.rootPaths = [];

    const started = startVLibrasWidget({
      VLibras: { Widget: FakeVLibrasWidget },
    });

    expect(started).toBe(true);
    expect(FakeVLibrasWidget.rootPaths).toEqual([VLIBRAS_APP_URL]);
  });

  // Uma extensão de bloqueio ou a rede do órgão podem barrar o script; o
  // VLibras é opcional e não pode derrubar a página.
  it("does nothing when the script did not expose the widget", () => {
    expect(startVLibrasWidget({})).toBe(false);
    expect(startVLibrasWidget({ VLibras: {} })).toBe(false);
  });
});

describe("VLibras", () => {
  it("loads the plugin lazily and starts it once loaded", async () => {
    const { VLibras } = await import("@/components/VLibras/VLibras");
    FakeVLibrasWidget.rootPaths = [];
    (window as unknown as { VLibras: unknown }).VLibras = {
      Widget: FakeVLibrasWidget,
    };

    render(<VLibras />);
    FakeScriptRecorder.last?.onLoad?.();

    expect(FakeScriptRecorder.last?.src).toBe(VLIBRAS_SCRIPT_URL);
    expect(FakeScriptRecorder.last?.strategy).toBe("lazyOnload");
    expect(FakeVLibrasWidget.rootPaths).toEqual([VLIBRAS_APP_URL]);
  });
});
