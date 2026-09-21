import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  AnalysisCoverage,
  AnalyzePayload,
  Cities,
  ExcludedCities,
} from "@/utils/amfeInterfaces";
import type { AnalysisMapImageOptions } from "@/components/Amfe/exportAnalysisMapImage";

const { downloadWorkbookMock, downloadImageMock } = vi.hoisted(() => ({
  downloadWorkbookMock: vi.fn(),
  downloadImageMock: vi.fn(),
}));

const { downloadReportMock, PopupBlockedErrorMock } = vi.hoisted(() => {
  class PopupBlockedErrorMock extends Error {}
  return { downloadReportMock: vi.fn(), PopupBlockedErrorMock };
});

const { useCriteriasMock } = vi.hoisted(() => ({
  useCriteriasMock: vi.fn(),
}));

vi.mock("@/components/Amfe/exportAnalysisWorkbook", () => ({
  downloadAnalysisWorkbook: downloadWorkbookMock,
}));

vi.mock("@/components/Amfe/exportAnalysisMapImage", () => ({
  downloadAnalysisMapImage: downloadImageMock,
}));

vi.mock("@/components/Amfe/exportAnalysisReport", () => ({
  downloadAnalysisReport: downloadReportMock,
  PopupBlockedError: PopupBlockedErrorMock,
}));

vi.mock("@/components/Amfe/useCriterias", () => ({
  default: useCriteriasMock,
}));

import { AmfeMapDownloadMenu } from "@/components/Amfe/AmfeMapDownloadMenu";

const CITIES: Cities = {
  "2500106": { name: "Areia", UF: "PB", classification: 4 },
};

const COVERAGE = { count: 1, totalCount: 2, excludedCount: 1 };

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
  coverage = COVERAGE,
  excludedCities = {},
}: {
  imageOptions?: AnalysisMapImageOptions | null;
  payload?: AnalyzePayload | null;
  cities?: Cities;
  coverage?: AnalysisCoverage | null;
  excludedCities?: ExcludedCities;
} = {}) =>
  render(
    <AmfeMapDownloadMenu
      cities={cities}
      coverage={coverage}
      excludedCities={excludedCities}
      payload={payload}
      imageOptions={imageOptions}
    />,
  );

beforeEach(() => {
  downloadWorkbookMock.mockReset().mockResolvedValue(undefined);
  downloadImageMock.mockReset().mockResolvedValue(undefined);
  downloadReportMock.mockReset().mockResolvedValue(undefined);
  useCriteriasMock.mockReset().mockReturnValue({
    criterias: [
      {
        name: "ia_mean",
        label: "Índice de Aridez Médio",
        is_benefit: true,
        unit: null,
        description: null,
        default: true,
      },
    ],
    loading: false,
    error: null,
  });
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

describe("relatório", () => {
  it("gera o relatório com o resultado e a cobertura da análise", async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.click(screen.getByRole("button", { name: /Download/ }));
    await user.click(screen.getByRole("button", { name: "PDF" }));

    await waitFor(() => expect(downloadReportMock).toHaveBeenCalledTimes(1));
    const [, cities, coverage, excluded, payload] =
      downloadReportMock.mock.calls[0];
    expect(cities).toBe(CITIES);
    expect(coverage).toBe(COVERAGE);
    expect(excluded).toEqual({});
    expect(payload).toBe(PAYLOAD);
  });

  it("monta o mapa de rótulos do catálogo de critérios e passa para o relatório", async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.click(screen.getByRole("button", { name: /Download/ }));
    await user.click(screen.getByRole("button", { name: "PDF" }));

    await waitFor(() => expect(downloadReportMock).toHaveBeenCalledTimes(1));
    const [, , , , , criteriaLabels] = downloadReportMock.mock.calls[0];
    expect(criteriaLabels).toEqual({ ia_mean: "Índice de Aridez Médio" });
  });

  it("avisa quando o navegador barra a janela", async () => {
    downloadReportMock.mockRejectedValue(new PopupBlockedErrorMock("blocked"));
    const user = userEvent.setup();
    renderMenu();

    await user.click(screen.getByRole("button", { name: /Download/ }));
    await user.click(screen.getByRole("button", { name: "PDF" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "O navegador bloqueou a janela do relatório",
      );
    });
  });

  it("desabilita o relatório sem análise rodada", async () => {
    const user = userEvent.setup();
    renderMenu({ payload: null });

    await user.click(screen.getByRole("button", { name: /Download/ }));

    expect(screen.getByRole("button", { name: "PDF" })).toBeDisabled();
  });

  it("avisa com uma mensagem própria de relatório numa falha genérica", async () => {
    downloadReportMock.mockRejectedValue(new Error("canvas context lost"));
    const user = userEvent.setup();
    renderMenu();

    await user.click(screen.getByRole("button", { name: /Download/ }));
    await user.click(screen.getByRole("button", { name: "PDF" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Erro ao gerar o relatório.",
      );
    });
  });
});
