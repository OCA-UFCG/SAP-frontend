import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AnalyzePayload, Cities } from "@/utils/amfeInterfaces";
import type { AnalysisMapImageOptions } from "@/components/Amfe/exportAnalysisMapImage";

const { downloadWorkbookMock, downloadImageMock } = vi.hoisted(() => ({
  downloadWorkbookMock: vi.fn(),
  downloadImageMock: vi.fn(),
}));

vi.mock("@/components/Amfe/exportAnalysisWorkbook", () => ({
  downloadAnalysisWorkbook: downloadWorkbookMock,
}));

vi.mock("@/components/Amfe/exportAnalysisMapImage", () => ({
  downloadAnalysisMapImage: downloadImageMock,
}));

import { AmfeMapDownloadMenu } from "@/components/Amfe/AmfeMapDownloadMenu";

const CITIES: Cities = {
  "2500106": { name: "Areia", UF: "PB", classification: 4 },
};

const PAYLOAD: AnalyzePayload = {
  criteria: [{ name: "ia_mean", value: 1, is_benefit: true }],
  thresholds: { indifference: 0.1, preference: 0.3, veto: 0.8 },
  model: { version: "1.0" },
  typeScenario: "optimistic",
  ranking: { level: "state" },
  interestArea: { type: "state", value: "PB" },
};

const IMAGE_OPTIONS: AnalysisMapImageOptions = {
  classification: {
    classificationByCode: { "2500106": 4 },
    excludedCodes: [],
  },
  overviewGeoJson: { type: "FeatureCollection", features: [] },
  boundaryGeoJson: null,
  allowedStateUfs: new Set(["pb"]),
  bounds: null,
};

const renderMenu = ({
  imageOptions = IMAGE_OPTIONS,
  payload = PAYLOAD,
  cities = CITIES,
}: {
  imageOptions?: AnalysisMapImageOptions | null;
  payload?: AnalyzePayload | null;
  cities?: Cities;
} = {}) =>
  render(
    <AmfeMapDownloadMenu
      cities={cities}
      payload={payload}
      imageOptions={imageOptions}
    />,
  );

beforeEach(() => {
  downloadWorkbookMock.mockReset().mockResolvedValue(undefined);
  downloadImageMock.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
});

describe("AmfeMapDownloadMenu", () => {
  it("keeps both formats behind the download button", async () => {
    const user = userEvent.setup();
    renderMenu();

    expect(screen.queryByRole("button", { name: "XLSX" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "PNG" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Download/ }));

    expect(screen.getByRole("button", { name: "XLSX" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "PNG" })).toBeInTheDocument();
  });

  it("exports the workbook and closes the menu", async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.click(screen.getByRole("button", { name: /Download/ }));
    await user.click(screen.getByRole("button", { name: "XLSX" }));

    expect(downloadWorkbookMock).toHaveBeenCalledWith(
      CITIES,
      PAYLOAD,
      expect.any(Function),
    );
    expect(screen.queryByRole("button", { name: "XLSX" })).not.toBeInTheDocument();
  });

  it("exports the png with everything the capture needs to redraw the analysis", async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.click(screen.getByRole("button", { name: /Download/ }));
    await user.click(screen.getByRole("button", { name: "PNG" }));

    expect(downloadImageMock).toHaveBeenCalledWith(
      IMAGE_OPTIONS,
      expect.any(Function),
    );
  });

  it("holds the png back until the overview geometry is available", async () => {
    const user = userEvent.setup();
    renderMenu({ imageOptions: null });

    await user.click(screen.getByRole("button", { name: /Download/ }));

    expect(screen.getByRole("button", { name: "PNG" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "XLSX" })).toBeEnabled();
  });

  it("surfaces a capture failure instead of failing silently", async () => {
    const user = userEvent.setup();
    downloadImageMock.mockRejectedValue(new Error("webgl context lost"));
    renderMenu();

    await user.click(screen.getByRole("button", { name: /Download/ }));
    await user.click(screen.getByRole("button", { name: "PNG" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Erro ao gerar a imagem PNG:",
      );
    });
  });

  it("stays available before any analysis, offering the map image alone", async () => {
    const user = userEvent.setup();
    renderMenu({
      payload: null,
      cities: {},
      imageOptions: { ...IMAGE_OPTIONS, classification: null },
    });

    await user.click(screen.getByRole("button", { name: /Download/ }));

    expect(screen.getByRole("button", { name: "PNG" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "XLSX" })).toBeDisabled();
  });

  it("closes the menu when clicking outside it", async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.click(screen.getByRole("button", { name: /Download/ }));
    expect(screen.getByRole("button", { name: "PNG" })).toBeInTheDocument();

    await user.click(document.body);

    expect(screen.queryByRole("button", { name: "PNG" })).not.toBeInTheDocument();
  });
});
