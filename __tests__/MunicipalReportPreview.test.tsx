import { cleanup, render, screen, waitFor } from "@testing-library/react";
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
        municipalityCode="5200050"
        period="2026"
        layerIds={["anaseca"]}
        embedded
      />,
    );

    expect(await screen.findByRole("article")).toBeInTheDocument();
    expect(screen.getByText("Monitor de Secas")).toBeInTheDocument();
    expect(
      screen.getByText("Distribuição espacial e série temporal"),
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
    expect(screen.getByRole("button", { name: "Sem seca" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      screen.getByRole("button", { name: "Sem seca" }).querySelector("span"),
    ).toHaveStyle({
      backgroundColor: "#b8b8b8",
    });
    expect(screen.getByRole("button", { name: "Normal" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Seca" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await user.click(screen.getByRole("button", { name: "Seca" }));

    expect(screen.getByRole("button", { name: "Seca" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );

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
        municipalityCode="5200050"
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
      "@page{size:A4;margin:14mm 15mm}",
    );
    expect(popupDocument.documentElement.outerHTML).toContain(
      "padding:0!important",
    );
    expect(popupDocument.documentElement.outerHTML).toContain(
      "grid-template-columns:minmax(0,.84fr) minmax(0,1.16fr)",
    );
    expect(popupDocument.documentElement.outerHTML).toContain(
      'data-report-pdf-measurements="10"',
    );
    expect(popupDocument.documentElement.outerHTML).toContain(
      'data-report-pdf-first-period="2017"',
    );
    expect(popupDocument.documentElement.outerHTML).toContain(
      'data-report-pdf-last-period="2026"',
    );
    expect(popupDocument.documentElement.outerHTML).toContain(
      ".report-chart-screen{display:none!important}",
    );
    expect(popupDocument.documentElement.outerHTML).toContain(
      ".report-visual-title{box-sizing:border-box;display:flex!important;min-height:16mm;align-items:center;justify-content:center}",
    );
    expect(popupDocument.documentElement.outerHTML).toContain(
      "object-fit:contain!important",
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

  it("shows an error when the browser blocks the PDF print window", async () => {
    const user = userEvent.setup();
    const openSpy = vi.spyOn(window, "open").mockReturnValue(null);

    render(
      <MunicipalReportPreview
        municipalityCode="5200050"
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
