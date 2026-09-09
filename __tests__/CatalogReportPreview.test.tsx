import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/IndexCatalog/catalogApiClient", () => ({
  catalogApiRequest: vi.fn(),
}));
vi.mock("@/services/mapServices", () => ({ fetchMapURL: vi.fn() }));
vi.mock("@/components/MunicipalReport/reportMapPool", () => ({
  destroyReportMapPool: vi.fn(),
}));

/** O mapa de verdade precisa de WebGL; aqui só interessa o que ele recebe. */
vi.mock("@/components/MunicipalReport/ReportMapPreview", () => ({
  ReportMapPreview: ({
    layerId,
    period,
    tileUrl,
  }: {
    layerId: string;
    period: string;
    tileUrl?: string;
  }) => (
    <div
      data-testid="report-map"
      data-layer={layerId}
      data-period={period}
      data-tile-url={tileUrl ?? ""}
    />
  ),
}));

import { CatalogReportPreview } from "@/components/IndexCatalog/CatalogReportPreview";
import { catalogApiRequest } from "@/components/IndexCatalog/catalogApiClient";
import { fetchMapURL } from "@/services/mapServices";
import type { MunicipalReportPeriodSnapshot } from "@/contracts/municipalReport";
import type { IndexCatalogReportPreview } from "@/types/indexCatalog";

const DRAFT_TILE_PATH = "/api/index-catalog/drafts/entry-1/ee";

function snapshot(period: string, arid: number): MunicipalReportPeriodSnapshot {
  const classes = [
    { id: "arido", label: "Árido", color: "#795548", percentage: arid },
    {
      id: "semiarido",
      label: "Semiárido",
      color: "#C8B273",
      percentage: 100 - arid,
    },
  ];
  return {
    period,
    label: period,
    distribution: classes,
    dominantClass: classes[1],
  };
}

function buildPreview(): IndexCatalogReportPreview {
  return {
    municipality: { code: "2504009", name: "Campina Grande", uf: "PB" },
    period: "2024",
    docsContent: {},
    report: {
      schemaVersion: 1,
      generatedAt: "2026-01-01T00:00:00.000Z",
      requestedPeriod: "2024",
      municipality: { code: "2504009", name: "Campina Grande", uf: "PB" },
      templateVariables: {},
      analyses: [
        {
          id: "indice-de-aridez-catalogo",
          alias: "aridez",
          // Um nome que não existe no dicionário de indicadores: é assim que
          // a nota escrita no catálogo chega às notas do relatório.
          title: "Índice de Aridez do Catálogo",
          unit: "%",
          valueType: "percentage",
          status: "available",
          requestedPeriod: "2024",
          effectivePeriod: "2024",
          classes: [
            { id: "arido", label: "Árido", color: "#795548" },
            { id: "semiarido", label: "Semiárido", color: "#C8B273" },
          ],
          snapshot: snapshot("2024", 16.6),
          timeSeries: [snapshot("2023", 10), snapshot("2024", 16.6)],
          presentation: {
            sectionColor: "#795548",
            methodology: "Razão entre precipitação e evapotranspiração.",
          },
        },
      ],
    },
  };
}

describe("CatalogReportPreview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(catalogApiRequest).mockResolvedValue(buildPreview());
    vi.mocked(fetchMapURL).mockResolvedValue("https://tiles/{z}/{x}/{y}");
  });
  afterEach(cleanup);

  it("desenha a imagem espacial do município com os tiles do rascunho", async () => {
    render(
      <CatalogReportPreview entryId="entry-1" tileApiPath={DRAFT_TILE_PATH} />,
    );

    const map = await screen.findByTestId("report-map");
    await waitFor(() =>
      expect(map).toHaveAttribute("data-tile-url", "https://tiles/{z}/{x}/{y}"),
    );
    expect(map).toHaveAttribute("data-period", "2024");
    // A rota do rascunho, e não `/api/ee`: o índice ainda não foi publicado.
    expect(fetchMapURL).toHaveBeenCalledWith(
      "indice-de-aridez-catalogo",
      "2024",
      expect.anything(),
      undefined,
      undefined,
      DRAFT_TILE_PATH,
    );
  });

  it("mostra o gráfico da série com uma classe por linha", async () => {
    render(
      <CatalogReportPreview entryId="entry-1" tileApiPath={DRAFT_TILE_PATH} />,
    );

    expect(
      await screen.findByText(/Série temporal por classe: 2023 a 2024/u),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Árido" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Semiárido" }),
    ).toBeInTheDocument();
  });

  it("fecha com as mesmas notas do relatório de verdade", async () => {
    render(
      <CatalogReportPreview entryId="entry-1" tileApiPath={DRAFT_TILE_PATH} />,
    );

    expect(
      await screen.findByRole("heading", {
        name: "Notas Metodológicas e Fontes",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Razão entre precipitação e evapotranspiração\./u),
    ).toBeInTheDocument();
    expect(screen.getByText(/Referência legal:/u)).toBeInTheDocument();
    expect(
      screen.getByText(/gerado automaticamente pelo Sistema Estratégico/u),
    ).toBeInTheDocument();
  });

  it("não desenha mapa nem gráfico quando o município não tem valores", async () => {
    const preview = buildPreview();
    preview.report.analyses[0].status = "unavailable";
    preview.report.analyses[0].snapshot = null;
    vi.mocked(catalogApiRequest).mockResolvedValue(preview);

    render(
      <CatalogReportPreview entryId="entry-1" tileApiPath={DRAFT_TILE_PATH} />,
    );

    expect(
      await screen.findByText(/O Earth Engine não devolveu valores/u),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("report-map")).not.toBeInTheDocument();
    expect(fetchMapURL).not.toHaveBeenCalled();
  });
});
