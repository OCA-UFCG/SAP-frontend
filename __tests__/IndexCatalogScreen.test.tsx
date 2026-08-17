import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/IndexCatalog/CatalogMonitoringPreview", () => ({
  CatalogMonitoringPreview: () => <div data-testid="catalog-preview-probe" />,
}));

import { IndexCatalogScreen } from "@/components/IndexCatalog/IndexCatalogScreen";

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

function fillMinimumForm() {
  fireEvent.change(screen.getByLabelText("Nome"), {
    target: { value: "Índice GEE" },
  });
  fireEvent.change(screen.getByLabelText("Descrição"), {
    target: { value: "Índice classificado" },
  });
  fireEvent.change(
    screen.getByPlaceholderText("projects/projeto/assets/estatisticas"),
    {
      target: { value: "projects/example/assets/statistics" },
    },
  );
  fireEvent.change(screen.getByLabelText("ID do asset de mapa"), {
    target: { value: "projects/example/assets/map" },
  });
}

describe("IndexCatalogScreen v2", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => jsonResponse({ items: [] })),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("has no Drive/CSV controls and sends a statisticsSource contract", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockImplementationOnce(() => jsonResponse({ items: [] }))
      .mockImplementationOnce(() =>
        jsonResponse({ entryId: "draft-1", panelLayerId: "indice-gee" }, 201),
      )
      .mockImplementationOnce(() => jsonResponse({ items: [] }));

    render(<IndexCatalogScreen />);
    await screen.findByText("Nenhum panelLayer encontrado.");
    expect(screen.queryByText(/Google Drive/iu)).not.toBeInTheDocument();
    expect(screen.queryByText(/CSV/iu)).not.toBeInTheDocument();
    fillMinimumForm();
    fireEvent.click(screen.getByRole("button", { name: "Salvar rascunho" }));

    expect(
      await screen.findByText("Rascunho salvo no sistema. Nada foi publicado."),
    ).toBeInTheDocument();
    const request = fetchMock.mock.calls[1];
    expect(request[0]).toBe("/api/index-catalog");
    const body = JSON.parse(String((request[1] as RequestInit).body));
    expect(body.statisticsSource).toEqual(
      expect.objectContaining({ kind: "gee-feature-collection" }),
    );
    expect(body).not.toHaveProperty("selectedFiles");
    expect(body).not.toHaveProperty("sourceTag");
    expect(body).not.toHaveProperty("unit");
  });

  it("explains the three catalog actions in plain language", async () => {
    render(<IndexCatalogScreen />);
    await screen.findByText("Nenhum panelLayer encontrado.");
    expect(
      screen.queryByRole("button", { name: "Novo índice" }),
    ).not.toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: "Salvar rascunho",
        description:
          "Guarda as informações preenchidas para você continuar depois. O índice ainda não aparece no Monitoramento.",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Validar assets e gerar prévia",
        description:
          "Confere se os dados e mapas podem ser usados e mostra uma prévia privada. O índice ainda não aparece no Monitoramento.",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Publicar",
        description:
          "Faz uma última conferência e disponibiliza o índice no Monitoramento. Os dados continuam guardados no Google Earth Engine.",
      }),
    ).toBeInTheDocument();
  });

  it("opens the guide with the real ANA example and omits period exceptions", async () => {
    render(<IndexCatalogScreen />);
    await screen.findByText("Nenhum panelLayer encontrado.");

    fireEvent.change(screen.getByLabelText("Organização"), {
      target: { value: "perPeriod" },
    });
    expect(
      screen.queryByText("Exceções por período (opcional, uma por linha)"),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "GUIA" }));
    expect(
      screen.getByRole("dialog", { name: "1. Identificação do índice" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("TESTE — Monitor de Secas ANA 2025"),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Próxima etapa" }));
    expect(
      screen.getByText(
        "projects/obscaatinga/assets/Estatisticas/Estatistica_Multinivel_MonitorANA_2025",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Única ou template?")).toBeInTheDocument();
  });

  it("infers class indexes from revalidation and shows the private preview", async () => {
    const preview = {
      entryId: "draft-1",
      panelLayer: {
        sys: { id: "draft-1" },
        id: "indice-gee",
        name: "Índice GEE",
        description: "Índice classificado",
        category: "Dados Climáticos",
        imageData: {
          schemaVersion: 1,
          type: "territorial-compact",
          classes: [
            { id: "classe-0", label: "Classe 0", color: "#D9ED92" },
            { id: "classe-1", label: "Classe 1", color: "#B5E48C" },
          ],
          locations: { br: "Brasil" },
          years: { "2025": { imageId: "map", values: {} } },
        },
        statisticsSource: {
          schemaVersion: 1,
          sourceRevision: "a".repeat(64),
          kind: "gee-feature-collection",
        },
      },
      validation: {
        valid: true,
        inferred: {
          periods: ["2025"],
          classIndexes: [0, 1],
          statisticsAssetCount: 1,
        },
      },
    };
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockImplementationOnce(() => jsonResponse({ items: [] }))
      .mockImplementationOnce(() => jsonResponse({ entryId: "draft-1" }, 201))
      .mockImplementationOnce(() => jsonResponse({ items: [] }))
      .mockImplementationOnce(() => jsonResponse(preview))
      .mockImplementationOnce(() => jsonResponse({ items: [] }));

    render(<IndexCatalogScreen />);
    await screen.findByText("Nenhum panelLayer encontrado.");
    fillMinimumForm();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Validar assets e gerar prévia",
      }),
    );

    expect(
      screen.getByRole("progressbar", {
        name: "Progresso estimado da validação",
      }),
    ).toHaveAttribute("aria-valuenow", "5");

    expect(
      await screen.findByTestId("catalog-preview-probe"),
    ).toBeInTheDocument();
    expect(screen.getAllByLabelText("Índice")).toHaveLength(2);
    expect(screen.getByDisplayValue("Classe 0")).toBeInTheDocument();
    expect(fetchMock.mock.calls.map(([url]) => url)).not.toContain(
      "/api/index-catalog/drive-search",
    );
  });

  it("keeps v1 and external panel layers read-only", async () => {
    vi.mocked(fetch).mockImplementationOnce(() =>
      jsonResponse({
        items: [
          {
            entryId: "legacy",
            panelLayerId: "seca",
            name: "Seca",
            description: "",
            published: true,
            hasUnpublishedChanges: false,
            catalogManaged: false,
            status: "legacy",
            catalogConfig: { schemaVersion: 1, panelLayerId: "seca" },
          },
        ],
      }),
    );
    render(<IndexCatalogScreen />);
    expect(
      await screen.findByText("Legado — somente leitura"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Abrir e editar" }),
    ).not.toBeInTheDocument();
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
  });
});
