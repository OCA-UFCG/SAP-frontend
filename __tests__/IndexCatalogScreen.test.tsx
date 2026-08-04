import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

describe("IndexCatalogScreen", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(() => jsonResponse({ items: [] })));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("searches the Drive, selects a compatible source and infers classes", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockImplementationOnce(() => jsonResponse({ items: [] }))
      .mockImplementationOnce(() =>
        jsonResponse({
          items: [
            {
              id: "drive-1",
              name: "Indice_Aridez.csv",
              mimeType: "text/csv",
              modifiedTime: "2026-07-30T12:00:00.000Z",
              size: "2048",
              inspection: {
                role: "multilevel",
                columns: [
                  "NIVEL_AGRUPAMENTO",
                  "NOME_LOCAL",
                  "valor_classe_1",
                  "valor_classe_2",
                ],
                periods: ["2025"],
                classColumns: ["valor_classe_1", "valor_classe_2"],
                warnings: [],
              },
            },
          ],
        }),
      );

    render(<IndexCatalogScreen />);
    await screen.findByText("Nenhum panelLayer encontrado.");

    fireEvent.change(screen.getByPlaceholderText("Ex.: desertificacao"), {
      target: { value: "aridez" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Buscar no Drive" }));

    expect(await screen.findByText("Indice_Aridez.csv")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "Selecionar Indice_Aridez.csv",
      }),
    );

    expect(screen.getByDisplayValue("Classe 1")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Classe 2")).toBeInTheDocument();
  });

  it("offers lifecycle controls for legacy entries and shows conditional unit", async () => {
    vi.mocked(fetch).mockImplementationOnce(() =>
      jsonResponse({
        items: [
          {
            entryId: "legacy",
            panelLayerId: "seca",
            name: "Seca",
            description: "Legado",
            published: true,
            hasUnpublishedChanges: false,
            catalogManaged: false,
            status: "legacy",
          },
        ],
      }),
    );

    render(<IndexCatalogScreen />);
    expect(await screen.findByText("Seca")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Mover para draft Seca" }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Remover Seca" }),
    ).toBeEnabled();

    fireEvent.change(screen.getByLabelText("Tipo de valor"), {
      target: { value: "absolute" },
    });
    await waitFor(() =>
      expect(screen.getByLabelText("Unidade")).toBeInTheDocument(),
    );
  });

  it("moves a published index to draft through the lifecycle API", async () => {
    const item = {
      entryId: "legacy",
      panelLayerId: "seca",
      name: "Seca",
      description: "Legado",
      published: true,
      hasUnpublishedChanges: false,
      catalogManaged: false,
      status: "legacy",
    };
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockImplementationOnce(() => jsonResponse({ items: [item] }))
      .mockImplementationOnce(() =>
        jsonResponse({
          entryId: "legacy",
          panelLayerId: "seca",
          status: "legacy",
        }),
      )
      .mockImplementationOnce(() =>
        jsonResponse({ items: [{ ...item, published: false }] }),
      );

    render(<IndexCatalogScreen />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Mover para draft Seca" }),
    );

    expect(
      await screen.findByText(
        "“Seca” está em draft e não aparece mais no Monitoramento.",
      ),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/index-catalog/entries/legacy",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ action: "unpublish" }),
      }),
    );
    expect(await screen.findByText("Legado em draft")).toBeInTheDocument();
  });

  it("reviews cascade impact and requires the technical id before deletion", async () => {
    const item = {
      entryId: "legacy",
      panelLayerId: "seca",
      name: "Seca",
      description: "Legado",
      published: true,
      hasUnpublishedChanges: false,
      catalogManaged: false,
      status: "legacy",
    };
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockImplementationOnce(() => jsonResponse({ items: [item] }))
      .mockImplementationOnce(() =>
        jsonResponse({
          item,
          linkedEntries: [],
          counts: {
            panelLayer: 1,
            municipalAnalysis: 2,
            municipalReportSeries: 3,
            total: 6,
          },
        }),
      )
      .mockImplementationOnce(() =>
        jsonResponse({
          entryId: "legacy",
          panelLayerId: "seca",
          status: "deleted",
          deletedEntries: 6,
        }),
      )
      .mockImplementationOnce(() => jsonResponse({ items: [] }));

    render(<IndexCatalogScreen />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Remover Seca" }),
    );

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    const removeButton = screen.getByRole("button", {
      name: "Remover 6 entrada(s)",
    });
    expect(removeButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Digite/), {
      target: { value: "seca" },
    });
    expect(removeButton).toBeEnabled();
    fireEvent.click(removeButton);

    expect(
      await screen.findByText(
        "“Seca” foi removido do Contentful (6 entrada(s)).",
      ),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "/api/index-catalog/entries/legacy",
      expect.objectContaining({
        method: "DELETE",
        body: JSON.stringify({ confirmation: "seca" }),
      }),
    );
  });
});
