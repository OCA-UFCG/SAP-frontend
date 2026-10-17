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
    layerId,
    choropleth,
    tileUrl,
  }: Pick<ComponentProps<"div">, "className"> & {
    active?: boolean;
    onCapture?: (src: string | null) => void;
    layerId?: string;
    choropleth?: unknown;
    tileUrl?: string;
  }) {
    reportMapPreviewRenderSpy({
      layerId,
      choropleth,
      tileUrl,
      ...(active ? { active } : {}),
    });
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

  // Regressão: com 39 camadas o nginx do beta devolvia uma página HTML de 502,
  // e a tela mostrava "Unexpected token '<' ... is not valid JSON".
  it("explica o erro do servidor em vez de mostrar a falha de leitura do JSON", async () => {
    global.fetch = vi.fn(
      async () =>
        new Response(
          "<html><head><title>502 Bad Gateway</title></head></html>",
          {
            status: 502,
            headers: { "Content-Type": "text/html" },
          },
        ),
    );

    render(
      <MunicipalReportPreview
        locationKey="5200050"
        period="2026"
        layerIds={["anaseca"]}
        embedded
      />,
    );

    expect(
      await screen.findByText(
        "O servidor não respondeu a tempo. Tente de novo em alguns instantes.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Unexpected token/)).not.toBeInTheDocument();
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

  it("pinta o mapa do índice de planilha e desenha a série de valor único", async () => {
    const povertySnapshot = (period: string, percentage: number) => {
      const item = {
        id: "pobreza",
        label: "Famílias em situação de pobreza",
        color: "#BD0026",
        percentage,
      };
      return {
        period,
        label: period,
        distribution: [item],
        dominantClass: item,
      };
    };
    const spreadsheetReport: MunicipalReportData = {
      ...report,
      analyses: [
        {
          id: "percentual-de-pobreza",
          alias: "pobreza",
          title: "Percentual de pobreza",
          category: "Dados Socioeconômicos",
          unit: "%",
          valueType: "percentage",
          status: "available",
          requestedPeriod: "2026",
          effectivePeriod: "2025",
          classes: [
            {
              id: "pobreza",
              label: "Famílias em situação de pobreza",
              color: "#BD0026",
            },
          ],
          snapshot: povertySnapshot("2025", 52.3),
          timeSeries: [
            povertySnapshot("2024", 56.3),
            povertySnapshot("2025", 52.3),
          ],
          mapChoropleth: { palette: ["#FFF", "#F00"], thresholds: [50] },
        },
      ],
    };
    vi.mocked(global.fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/docs?")) return Response.json({ content: {} });
      if (url.includes("/choropleth?")) {
        return Response.json({
          year: "2025",
          values: { "5200050": 52.3, "5200100": 40 },
        });
      }
      if (url.includes("/api/ee/map-urls")) return Response.json({ maps: [] });
      return Response.json(spreadsheetReport);
    });

    render(
      <MunicipalReportPreview
        locationKey="5200050"
        period="2026"
        layerIds={["percentual-de-pobreza"]}
        embedded
      />,
    );

    expect(await screen.findByText("Série temporal")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Baixar PDF" })).toBeEnabled();
    });
    expect(reportMapPreviewRenderSpy).toHaveBeenLastCalledWith({
      layerId: "percentual-de-pobreza",
      choropleth: {
        palette: ["#FFF", "#F00"],
        classByCode: { "5200050": 1, "5200100": 0 },
      },
      tileUrl: undefined,
    });
    const requestedUrls = vi
      .mocked(global.fetch)
      .mock.calls.map(([input]) => String(input));
    expect(
      requestedUrls.some((url) =>
        url.includes(
          "/api/municipal-analysis/percentual-de-pobreza/choropleth?year=2025",
        ),
      ),
    ).toBe(true);
    // Sem imagem no Earth Engine, o índice não entra no pedido de URLs.
    expect(requestedUrls.some((url) => url.includes("/api/ee/map-urls"))).toBe(
      false,
    );
  });

  // O índice de planilha não depende do Earth Engine: ele pega uma vaga da
  // fila assim que os valores municipais chegam, sem esperar a URL das camadas
  // de imagem, que no frio de um deploy pode levar segundos.
  it("desenha o mapa de planilha enquanto as URLs do Earth Engine ainda não voltaram", async () => {
    const spreadsheetAnalysis = {
      ...report.analyses[0],
      id: "percentual-de-pobreza",
      alias: "pobreza",
      title: "Percentual de pobreza",
      mapChoropleth: { palette: ["#FFF", "#F00"], thresholds: [50] },
    };
    const mixedReport: MunicipalReportData = {
      ...report,
      analyses: [report.analyses[0], spreadsheetAnalysis],
    };
    vi.mocked(global.fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/docs?")) return Response.json({ content: {} });
      if (url.includes("/choropleth?")) {
        return Response.json({ year: "2026", values: { "5200050": 52.3 } });
      }
      // O Earth Engine nunca responde neste teste.
      if (url.includes("/api/ee/map-urls")) return new Promise(() => {});
      return Response.json(mixedReport);
    });

    render(
      <MunicipalReportPreview
        locationKey="5200050"
        period="2026"
        layerIds={["anaseca", "percentual-de-pobreza"]}
        embedded
      />,
    );

    await waitFor(() => {
      expect(reportMapPreviewRenderSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          layerId: "percentual-de-pobreza",
          active: true,
          choropleth: expect.any(Object),
        }),
      );
    });
    expect(reportMapPreviewRenderSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({ layerId: "anaseca", active: true }),
    );
  });

  it("junta as previsões da mesma fonte, variável e periodicidade numa seção só", async () => {
    const forecastClasses = [
      { id: "abaixo", label: "Levemente abaixo", color: "#F5E199" },
      { id: "acima", label: "Levemente acima", color: "#B9D8E7" },
    ];
    const forecastSnapshot = (
      period: string,
      abaixo: number,
    ): MunicipalReportPeriodSnapshot => {
      const distribution = [
        { ...forecastClasses[0], percentage: abaixo },
        { ...forecastClasses[1], percentage: 100 - abaixo },
      ];
      return {
        period,
        label: period,
        distribution,
        dominantClass: abaixo >= 50 ? distribution[0] : distribution[1],
      };
    };
    const forecast = (id: string, kind: string, abaixo: number) => ({
      id,
      alias: id,
      title: `Previsão: ${kind} Precipitação Mensal | INMET`,
      category: "Dados Climáticos",
      unit: "%",
      valueType: "percentage" as const,
      status: "available" as const,
      requestedPeriod: "2026-12",
      effectivePeriod: "2026-12",
      classes: forecastClasses,
      snapshot: forecastSnapshot("2026-12", abaixo),
      timeSeries: [
        forecastSnapshot("2026-11", 40),
        forecastSnapshot("2026-12", abaixo),
      ],
      presentation: { methodology: "Modelo atmosférico do INMET." },
      forecast: {
        source: "INMET",
        variable: "Precipitação",
        kind,
        periodicity: "monthly" as const,
      },
    });
    const forecastReport: MunicipalReportData = {
      ...report,
      requestedPeriod: "2026-12",
      analyses: [
        forecast("prob", "Probabilidade", 10),
        forecast("anom", "Anomalia", 71.7),
        report.analyses[0],
        forecast("acum", "Acumulado", 0),
      ],
    };
    vi.mocked(global.fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/docs?")) return Response.json({ content: {} });
      if (url.includes("/api/ee/map-urls")) return Response.json({ maps: [] });
      return Response.json(forecastReport);
    });

    render(
      <MunicipalReportPreview locationKey="5200050" period="2026-12" embedded />,
    );

    expect(await screen.findByRole("article")).toBeInTheDocument();
    const sections = document.querySelectorAll(".report-section");
    expect([...sections].map((section) => section.id)).toEqual([
      "report-analysis-previsao_inmet_precipitacao_monthly",
      "report-analysis-seca",
    ]);
    // Uma linha no sumário e um título na seção, no lugar de três de cada.
    expect(screen.getAllByText("Previsão: Precipitação (INMET)")).toHaveLength(
      2,
    );
    expect(
      screen.getByRole("link", {
        name: /Ir para a seção de Previsão: Precipitação \(INMET\)/,
      }),
    ).toHaveAttribute(
      "href",
      "#report-analysis-previsao_inmet_precipitacao_monthly",
    );

    const group = sections[0] as HTMLElement;
    expect(group.textContent).toContain(
      "No município de Abadia de Goiás — GO, para dezembro de 2026, a previsão de precipitação do INMET indica anomalia na faixa Levemente abaixo, em 71,70% da área analisada, acumulado na faixa Levemente acima, em 100,00% da área analisada e probabilidade na faixa Levemente acima, em 90,00% da área analisada.",
    );
    // Uma barra por período em cada tipo, com o de referência destacado.
    expect(group.querySelectorAll("[data-report-forecast-bar]")).toHaveLength(
      6,
    );
    expect(
      group.querySelectorAll('[data-report-forecast-bar="2026-12"][data-reference]'),
    ).toHaveLength(3);
    // A nota que os três tipos dividem aparece uma vez na seção e uma nas notas.
    expect(screen.getAllByText(/Modelo atmosférico do INMET\./)).toHaveLength(
      2,
    );
    await waitFor(() => {
      expect(
        new Set(
          reportMapPreviewRenderSpy.mock.calls.map(([props]) => props.layerId),
        ),
      ).toEqual(new Set(["anaseca", "anom", "acum", "prob"]));
    });
  });

  it("leva o pedido do relatório no link Ver produto, para a volta não perdê-lo", async () => {
    render(
      <MunicipalReportPreview
        locationKey="5200050"
        period="2026"
        layerIds={["anaseca"]}
        embedded
      />,
    );

    const link = await screen.findByRole("link", { name: "Ver produto" });
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

    await user.click(await screen.findByRole("link", { name: "Ver produto" }));

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
