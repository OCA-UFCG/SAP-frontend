import { afterEach, describe, expect, it, vi } from "vitest";
import type { AnalyzePayload, Cities } from "@/utils/amfeInterfaces";
import type { AnalysisMapImageOptions } from "@/components/Amfe/exportAnalysisMapImage";

const { buildMapPngMock } = vi.hoisted(() => ({
  buildMapPngMock: vi.fn(),
}));

vi.mock("@/components/Amfe/exportAnalysisMapImage", () => ({
  buildAnalysisMapPng: buildMapPngMock,
}));

import {
  PopupBlockedError,
  downloadAnalysisReport,
} from "@/components/Amfe/exportAnalysisReport";

const t = (key: string, values?: Record<string, string | number>) =>
  values ? `${key}:${Object.values(values).join("|")}` : key;

const CITIES: Cities = {
  "2500106": { name: "Areia", UF: "PB", classification: 4 },
};

const PAYLOAD: AnalyzePayload = {
  criteria: [{ name: "ips", value: 1, is_benefit: true }],
  thresholds: { indifference: 0.02, preference: 0.1, veto: 0.5 },
  model: { version: "1.0" },
  typeScenario: "pessimistic",
  ranking: { level: "state" },
  interestArea: { type: "state", value: "PB" },
};

const OPTIONS = {} as AnalysisMapImageOptions;

const CRITERIA_LABELS = { ips: "Índice de Progresso Social" };

const stubPrintWindow = (readyState: "complete" | "loading" = "complete") => {
  const printWindow = {
    document: {
      open: vi.fn(),
      write: vi.fn(),
      close: vi.fn(),
      readyState,
      title: "",
    },
    addEventListener: vi.fn(),
    focus: vi.fn(),
    print: vi.fn(),
    close: vi.fn(),
    closed: false,
  };

  vi.stubGlobal(
    "open",
    vi.fn(() => printWindow),
  );

  return printWindow;
};

const run = () =>
  downloadAnalysisReport(
    OPTIONS,
    CITIES,
    null,
    {},
    PAYLOAD,
    CRITERIA_LABELS,
    t,
    "pt",
  );

describe("downloadAnalysisReport", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("abre a janela antes de capturar o mapa", async () => {
    const printWindow = stubPrintWindow();
    let openedBeforeCapture = false;
    buildMapPngMock.mockImplementation(async () => {
      openedBeforeCapture = printWindow.document.write.mock.calls.length > 0;
      return "data:image/png;base64,AAAA";
    });

    // Sem fake timers aqui: este teste não espera o `print()`, e o setTimeout
    // pendente só chamaria um método do stub depois que o teste terminou.
    await run();

    expect(openedBeforeCapture).toBe(true);
  });

  it("recusa sem janela e diz por quê", async () => {
    vi.stubGlobal(
      "open",
      vi.fn(() => null),
    );

    await expect(run()).rejects.toBeInstanceOf(PopupBlockedError);
    expect(buildMapPngMock).not.toHaveBeenCalled();
  });

  it("fecha a janela quando a captura falha", async () => {
    const printWindow = stubPrintWindow();
    buildMapPngMock.mockRejectedValue(
      new Error("Map capture returned no image"),
    );

    await expect(run()).rejects.toThrow("Map capture returned no image");
    expect(printWindow.close).toHaveBeenCalled();
    expect(printWindow.print).not.toHaveBeenCalled();
  });

  it("escreve o documento e manda imprimir", async () => {
    const printWindow = stubPrintWindow();
    buildMapPngMock.mockResolvedValue("data:image/png;base64,AAAA");

    // O `print()` roda num setTimeout de 300ms, para dar tempo ao data URL do
    // mapa decodificar. `await run()` não depende de timer — a promessa
    // resolve por microtask — então dá para adiantar o relógio depois dela.
    vi.useFakeTimers();
    await run();
    vi.advanceTimersByTime(300);

    const written = printWindow.document.write.mock.calls.at(-1)?.[0] as string;
    expect(written).toContain("reportTitle");
    expect(written).toContain("data:image/png;base64,AAAA");
    // Prova que o mapa de rótulos chega até o HTML renderizado.
    expect(written).toContain("Índice de Progresso Social");
    expect(printWindow.print).toHaveBeenCalled();
  });

  it("cancela em silêncio quando a janela é fechada durante a captura", async () => {
    const printWindow = stubPrintWindow();
    buildMapPngMock.mockImplementation(async () => {
      printWindow.closed = true;
      return "data:image/png;base64,AAAA";
    });

    await expect(run()).resolves.toBeUndefined();

    expect(printWindow.print).not.toHaveBeenCalled();
    expect(printWindow.close).not.toHaveBeenCalled();
  });

  it("imprime pelo listener de load quando o documento ainda está carregando", async () => {
    // Depois de document.close() o readyState real é "interactive", não
    // "complete" — este é o caminho que a produção de fato usa.
    const printWindow = stubPrintWindow("loading");
    buildMapPngMock.mockResolvedValue("data:image/png;base64,AAAA");

    vi.useFakeTimers();
    await run();

    const loadCall = printWindow.addEventListener.mock.calls.find(
      ([event]) => event === "load",
    );
    expect(loadCall).toBeDefined();
    (loadCall?.[1] as () => void)();
    vi.advanceTimersByTime(300);

    expect(printWindow.print).toHaveBeenCalled();
  });
});
