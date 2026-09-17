import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { resolveReportTerritory } from "@/utils/reportTerritory";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEffect, useRef } from "react";
import type { ComponentProps } from "react";
import type {
  MunicipalReportData,
  MunicipalReportPeriodSnapshot,
} from "@/contracts/municipalReport";
import { MunicipalReportPreview } from "@/components/MunicipalReport/MunicipalReportPreview";

const { reportMapPreviewRenderSpy } = vi.hoisted(() => ({
  reportMapPreviewRenderSpy: vi.fn(),
}));

vi.mock("@/components/MunicipalReport/ReportMapPreview", () => ({
  ReportMapPreview({
    active,
    onCapture,
  }: Pick<ComponentProps<"div">, "className"> & {
    active?: boolean;
    onCapture?: (src: string | null) => void;
  }) {
    reportMapPreviewRenderSpy();
    const capturedRef = useRef(false);

    useEffect(() => {
      if (!active || capturedRef.current) return;
      capturedRef.current = true;
      onCapture?.(`data:image/png;base64,${"a".repeat(120)}`);
    }, [active, onCapture]);

    return <div data-testid="report-map-preview" />;
  },
}));

vi.mock("@/utils/municipalReportMetrics", () => ({
  finishMunicipalReportMetrics: vi.fn(),
  recordMunicipalReportNavigation: vi.fn(),
  startMunicipalReportStage: vi.fn(() => vi.fn()),
}));

const reportTimeSeries: MunicipalReportPeriodSnapshot[] = Array.from(
  { length: 12 },
  (_, index) => {
    const period = String(2015 + index);
    const normalPercentage = 50 + index;

    return {
      period,
      label: period,
      distribution: [
        {
          id: "sem-seca",
          label: "Sem seca",
          color: "#FFFFFF",
          percentage: 0,
        },
        {
          id: "normal",
          label: "Normal",
          color: "#3c8f4d",
          percentage: normalPercentage,
        },
        {
          id: "seca",
          label: "Seca",
          color: "#d97706",
          percentage: 100 - normalPercentage,
        },
      ],
      dominantClass: {
        id: "normal",
        label: "Normal",
        color: "#3c8f4d",
        percentage: normalPercentage,
      },
    };
  },
);

const report: MunicipalReportData = {
  schemaVersion: 1,
  generatedAt: "2026-07-15T12:00:00.000Z",
  requestedPeriod: "2026",
  territory: resolveReportTerritory("5200050")!,
  municipality: {
    code: "5200050",
    name: "Abadia de Goiás",
    uf: "GO",
  },
  templateVariables: {},
  analyses: [
    {
      id: "anaseca",
      alias: "seca",
      title: "Monitor de Secas",
      unit: "%",
      valueType: "percentage",
      status: "available",
      requestedPeriod: "2026",
      effectivePeriod: "2026",
      classes: [
        { id: "sem-seca", label: "Sem seca", color: "#FFFFFF" },
        { id: "normal", label: "Normal", color: "#3c8f4d" },
        { id: "seca", label: "Seca", color: "#d97706" },
      ],
      snapshot: {
        period: "2026",
        label: "2026",
        distribution: [
          {
            id: "sem-seca",
            label: "Sem seca",
            color: "#FFFFFF",
            percentage: 0,
          },
          { id: "normal", label: "Normal", color: "#3c8f4d", percentage: 70 },
          { id: "seca", label: "Seca", color: "#d97706", percentage: 30 },
        ],
        dominantClass: {
          id: "normal",
          label: "Normal",
          color: "#3c8f4d",
          percentage: 70,
        },
      },
      timeSeries: reportTimeSeries,
    },
  ],
};

describe("MunicipalReportPreview", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    reportMapPreviewRenderSpy.mockClear();
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/docs?")) {
        return Response.json({ content: {} });
      }

      if (url.includes("/api/ee/map-urls")) {
        return Response.json({
          maps: [
            {
              name: "anaseca",
              year: "2026",
              url: "https://tiles.example/{z}/{x}/{y}",
            },
          ],
        });
      }

      return Response.json(report);
    });
  });

  afterEach(() => {
    cleanup();
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("renders the report with PDF download and zoom controls", async () => {
    const user = userEvent.setup();

    render(
      <MunicipalReportPreview
        locationKey="5200050"
        period="2026"
        layerIds={["anaseca"]}
        embedded
      />,
    );

    expect(await screen.findByRole("article")).toBeInTheDocument();
    // Duas ocorrências: o item do índice navegável e o cabeçalho da seção.
    expect(screen.getAllByText("Monitor de Secas")).toHaveLength(2);
    expect(
      screen.getByRole("link", { name: /Ir para a seção de Monitor de Secas/ }),
    ).toHaveAttribute("href", "#report-analysis-seca");
    expect(screen.getByText("Distribuição espacial")).toBeInTheDocument();
    expect(screen.getByText("Série temporal por classe")).toBeInTheDocument();
    expect(
      screen.getByText("Classes por cobertura (%) da área"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "HTML" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Formato PDF" }),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("Aumentar zoom")).toBeInTheDocument();
    expect(screen.getByLabelText("Diminuir zoom")).toBeInTheDocument();
    expect(
      screen.getByText("100%", { selector: "output" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("--")).not.toBeInTheDocument();
    // A legenda do gráfico empilhado não é interativa: esconder uma classe faria
    // as colunas deixarem de somar 100, ou renormalizar em silêncio.
    expect(
      screen.queryByRole("button", { name: "Sem seca" }),
    ).not.toBeInTheDocument();

    // As barras usam a cor verdadeira da classe, sem escurecer, e um fio de
    // contorno é o que mantém visível a classe branca.
    const bars = document.querySelectorAll("[data-report-class-bar]");
    expect(bars).toHaveLength(3);
    expect(bars[0]).toHaveStyle({ backgroundColor: "#FFFFFF" });
    expect(bars[0].className).toContain("border-black/10");

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Baixar PDF" })).toBeEnabled();
    });

    const mapRenderCountBeforeZoom =
      reportMapPreviewRenderSpy.mock.calls.length;
    await user.click(screen.getByLabelText("Aumentar zoom"));
    expect(screen.getByText("110%")).toBeInTheDocument();
    expect(reportMapPreviewRenderSpy).toHaveBeenCalledTimes(
      mapRenderCountBeforeZoom,
    );

    await user.click(screen.getByLabelText("Diminuir zoom"));
    expect(
      screen.getByText("100%", { selector: "output" }),
    ).toBeInTheDocument();
    expect(
      vi
        .mocked(global.fetch)
        .mock.calls.some(([input]) => String(input).includes("/chart?")),
    ).toBe(false);
  });

  it("leva o pedido do relatório no link Ver monitor, para a volta não perdê-lo", async () => {
    render(
      <MunicipalReportPreview
        locationKey="5200050"
        period="2026"
        layerIds={["anaseca"]}
        embedded
      />,
    );

    const link = await screen.findByRole("link", { name: "Ver monitor" });
    const href = link.getAttribute("href") ?? "";

    // Trocar de seção pelo trilho lateral preserva a URL; este link navega e a
    // substituiria, então o pedido precisa viajar junto.
    expect(href).toContain("layer=anaseca");
    expect(href).toContain("locationKey=5200050");
    expect(href).toContain("period=2026");
    expect(href).toContain("layers=anaseca");
  });

  it("abre o monitoramento sem navegar quando a plataforma oferece o atalho", async () => {
    const user = userEvent.setup();
    const onOpenMonitor = vi.fn();

    render(
      <MunicipalReportPreview
        locationKey="5200050"
        period="2026"
        layerIds={["anaseca"]}
        onOpenMonitor={onOpenMonitor}
        embedded
      />,
    );

    await user.click(await screen.findByRole("link", { name: "Ver monitor" }));

    // Navegar descartava o CSS do chunk do relatório e o custo era uma ida ao
    // servidor; dentro da plataforma a troca é estado de cliente.
    expect(onOpenMonitor).toHaveBeenCalledWith("anaseca");
  });

  it("opens the PDF print flow with a descriptive filename", async () => {
    const user = userEvent.setup();
    const popupDocument = document.implementation.createHTMLDocument();
    const focus = vi.fn();
    const print = vi.fn();
    const close = vi.fn();
    const popup = {
      document: popupDocument,
      focus,
      print,
      close,
      addEventListener: vi.fn(),
    } as unknown as Window;
    const openSpy = vi.spyOn(window, "open").mockReturnValue(popup);

    render(
      <MunicipalReportPreview
        locationKey="5200050"
        period="2026"
        layerIds={["anaseca"]}
        embedded
      />,
    );

    const downloadButton = await screen.findByRole("button", {
      name: "Baixar PDF",
    });
    await waitFor(() => expect(downloadButton).toBeEnabled());
    await user.click(downloadButton);

    expect(openSpy).toHaveBeenCalledWith(
      "",
      "_blank",
      "popup,width=980,height=800",
    );
    expect(popupDocument.documentElement.outerHTML).toContain(
      "Monitor de Secas",
    );
    expect(popupDocument.documentElement.outerHTML).toContain(
      "@page{size:A4;margin:12mm 14mm}",
    );
    expect(popupDocument.documentElement.outerHTML).toContain(
      "padding:0!important",
    );
    expect(popupDocument.documentElement.outerHTML).toContain(
      ".report-map-frame{aspect-ratio:auto!important;height:70mm!important}",
    );
    // O gráfico do PDF é o SVG de viewBox fixo, e o período de referência
    // continua marcado com asterisco no eixo.
    expect(popupDocument.documentElement.outerHTML).toContain(
      'data-stack-segment="2026:normal"',
    );
    expect(popupDocument.documentElement.outerHTML).toContain(
      'viewBox="0 0 640 330"',
    );
    expect(popupDocument.documentElement.outerHTML).toContain(">2026*<");
    expect(popupDocument.documentElement.outerHTML).toContain(
      ".report-chart-screen{display:none!important}",
    );
    expect(popupDocument.documentElement.outerHTML).toContain(
      ".report-chart-print{display:block!important}",
    );
    expect(popupDocument.documentElement.outerHTML).toContain(
      "object-fit:contain!important",
    );
    // Regressão: os cartões de mapa, gráfico e barras eram indivisíveis, então
    // o terceiro pulava de página e deixava meia folha em branco. Só a imagem e
    // o SVG seguem indivisíveis.
    expect(popupDocument.documentElement.outerHTML).toContain(
      ".report-time-series,.report-spatial,.report-class-coverage{break-inside:auto;page-break-inside:auto}",
    );
    expect(popupDocument.documentElement.outerHTML).toContain(
      ".report-map-frame,.report-chart-print{break-inside:avoid;page-break-inside:avoid}",
    );
    expect(popupDocument.title).toBe("Relatório-Abadia-de-Goiás-2026.pdf");

    const loadListener = vi
      .mocked(popup.addEventListener)
      .mock.calls.find(([eventName]) => eventName === "load")?.[1];
    if (typeof loadListener === "function") {
      loadListener(new Event("load"));
    }
    await waitFor(() => expect(print).toHaveBeenCalled());
    expect(focus).toHaveBeenCalledBefore(print);

    const afterPrintListener = vi
      .mocked(popup.addEventListener)
      .mock.calls.find(([eventName]) => eventName === "afterprint")?.[1];
    expect(afterPrintListener).toBeTypeOf("function");
    if (typeof afterPrintListener === "function") {
      afterPrintListener(new Event("afterprint"));
    }
    expect(close).toHaveBeenCalled();
  });

  // Regressão: a janela de impressão monta um <body> novo, sem a className do
  // next/font que o layout põe no <body> do app, e o PDF saía numa fonte de
  // sistema em vez de Open Sans.
  it("carries the app font variables into the print window body", async () => {
    const user = userEvent.setup();
    // Com aspas duplas, como o next/font resolve de verdade: é o que truncava o
    // atributo style e deixava o PDF sem a fonte.
    document.body.style.setProperty("--font-open-sans", '"Open Sans teste"');
    document.body.style.setProperty("--font-inter", '"Inter teste"');
    const popupDocument = document.implementation.createHTMLDocument();
    const popup = {
      document: popupDocument,
      focus: vi.fn(),
      print: vi.fn(),
      close: vi.fn(),
      addEventListener: vi.fn(),
    } as unknown as Window;
    vi.spyOn(window, "open").mockReturnValue(popup);

    render(
      <MunicipalReportPreview
        locationKey="5200050"
        period="2026"
        layerIds={["anaseca"]}
        embedded
      />,
    );

    const downloadButton = await screen.findByRole("button", {
      name: "Baixar PDF",
    });
    await waitFor(() => expect(downloadButton).toBeEnabled());
    await user.click(downloadButton);

    const printedHtml = popupDocument.documentElement.outerHTML;
    expect(printedHtml).toContain(
      'body{--font-open-sans:"Open Sans teste";--font-inter:"Inter teste"}',
    );

    document.body.style.removeProperty("--font-open-sans");
    document.body.style.removeProperty("--font-inter");
  });

  it("shows an error when the browser blocks the PDF print window", async () => {
    const user = userEvent.setup();
    const openSpy = vi.spyOn(window, "open").mockReturnValue(null);

    render(
      <MunicipalReportPreview
        locationKey="5200050"
        period="2026"
        layerIds={["anaseca"]}
        embedded
      />,
    );

    const downloadButton = await screen.findByRole("button", {
      name: "Baixar PDF",
    });
    await waitFor(() => expect(downloadButton).toBeEnabled());
    await user.click(downloadButton);

    expect(openSpy).toHaveBeenCalledWith(
      "",
      "_blank",
      "popup,width=980,height=800",
    );
    expect(
      screen.getByText(
        "O navegador bloqueou a janela de impressão. Permita pop-ups para baixar o relatório em PDF.",
      ),
    ).toBeInTheDocument();
  });
});
