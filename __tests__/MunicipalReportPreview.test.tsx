import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEffect, useRef } from "react";
import type { ComponentProps } from "react";
import type { MunicipalReportData } from "@/contracts/municipalReport";
import { MunicipalReportPreview } from "@/components/MunicipalReport/MunicipalReportPreview";

vi.mock("@/components/MunicipalReport/ReportMapPreview", () => ({
  ReportMapPreview({
    active,
    onCapture,
  }: Pick<ComponentProps<"div">, "className"> & {
    active?: boolean;
    onCapture?: (src: string | null) => void;
  }) {
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
        { id: "normal", label: "Normal", color: "#3c8f4d" },
        { id: "seca", label: "Seca", color: "#d97706" },
      ],
      snapshot: {
        period: "2026",
        label: "2026",
        distribution: [
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
      timeSeries: [
        {
          period: "2025",
          label: "2025",
          distribution: [
            { id: "normal", label: "Normal", color: "#3c8f4d", percentage: 50 },
            { id: "seca", label: "Seca", color: "#d97706", percentage: 50 },
          ],
          dominantClass: {
            id: "normal",
            label: "Normal",
            color: "#3c8f4d",
            percentage: 50,
          },
        },
        {
          period: "2026",
          label: "2026",
          distribution: [
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
      ],
    },
  ],
};

describe("MunicipalReportPreview", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/docs?")) {
        return Response.json({ content: {} });
      }

      if (url.includes("/chart?")) {
        return Response.json({
          report,
          charts: [
            {
              alias: "seca",
              contentType: "image/svg+xml",
              base64: btoa("<svg />"),
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
  });

  it("renders HTML by default and restores PDF-style controls in the PDF format preview", async () => {
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
    expect(screen.getByText("Distribuição espacial e série temporal")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "HTML" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Formato PDF" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByLabelText("Aumentar zoom")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Diminuir zoom")).not.toBeInTheDocument();
    expect(screen.queryByText("75%")).not.toBeInTheDocument();
    expect(screen.queryByText("--")).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Download" })).toBeEnabled();
    });

    await user.click(screen.getByRole("button", { name: "Formato PDF" }));

    expect(screen.getByRole("button", { name: "HTML" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Formato PDF" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Aumentar zoom")).toBeInTheDocument();
    expect(screen.getByLabelText("Diminuir zoom")).toBeInTheDocument();
    expect(screen.getByText("75%")).toBeInTheDocument();
    expect(screen.queryByText("--")).not.toBeInTheDocument();

    await user.click(screen.getByLabelText("Aumentar zoom"));

    expect(screen.getByText("85%")).toBeInTheDocument();
  });
});
