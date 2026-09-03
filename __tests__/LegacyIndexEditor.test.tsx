import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";

// A captura de mapa e a prévia do relatório têm testes próprios; aqui elas só
// consumiriam as respostas encadeadas de fetch.
vi.mock("@/components/IndexCatalog/CatalogPreviewMapCapture", () => ({
  CatalogPreviewMapCapture: () => (
    <div data-testid="catalog-preview-map-probe" />
  ),
  resolvePreviewMapPeriod: () => "2020",
}));
vi.mock("@/components/IndexCatalog/CatalogReportPreview", () => ({
  CatalogReportPreview: () => (
    <div data-testid="catalog-report-preview-probe" />
  ),
}));

import { LegacyIndexEditor } from "@/components/IndexCatalog/LegacyIndexEditor";
import type { IndexCatalogItem } from "@/types/indexCatalog";

const inputClass = "input";
const buttonClass = "button";

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

function adoptedItem(overrides: Partial<IndexCatalogItem> = {}) {
  return {
    entryId: "entry-legacy",
    panelLayerId: "s2id_secas_estiagens",
    name: "Registros de Secas e Estiagens",
    description: "Ocorrências registradas no S2iD.",
    category: "Dados Climáticos",
    measurementUnit: "registros",
    panelPosition: 4,
    published: true,
    everPublished: true,
    hasUnpublishedChanges: false,
    catalogManaged: true,
    managedScope: "presentation",
    adoptable: false,
    status: "published",
    catalogConfig: {
      schemaVersion: 2,
      managedScope: "presentation",
      panelLayerId: "s2id_secas_estiagens",
      status: "published",
      name: "Registros de Secas e Estiagens",
      description: "Ocorrências registradas no S2iD.",
      category: "Dados Climáticos",
      measurementUnit: "registros",
      createdBy: { uid: "a", email: null, at: "2026-09-01T10:00:00.000Z" },
      updatedBy: { uid: "a", email: null, at: "2026-09-01T10:00:00.000Z" },
      adoptedFrom: { at: "2026-09-01T10:00:00.000Z" },
    },
    ...overrides,
  } as IndexCatalogItem;
}

function renderEditor(item = adoptedItem()) {
  const onChanged = vi.fn();
  render(
    <LegacyIndexEditor
      item={item}
      inputClass={inputClass}
      buttonClass={buttonClass}
      onChanged={onChanged}
      onClose={vi.fn()}
    />,
  );
  return { onChanged };
}

function requestBody(call: number) {
  const [, init] = vi.mocked(fetch).mock.calls[call] as [string, RequestInit];
  return JSON.parse(String(init.body)) as Record<string, unknown>;
}

describe("LegacyIndexEditor", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => jsonResponse({})),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("mostra só o que o catálogo gerencia num legado", () => {
    renderEditor();

    expect(screen.getByLabelText("Unidade de medida")).toHaveValue("registros");
    expect(screen.getByLabelText("Posição na categoria")).toHaveValue("4");
    // Nada de estatísticas, mapa ou classes: mexer nisso mudaria os números.
    expect(
      screen.queryByText("Fonte das estatísticas"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Visualização do mapa")).not.toBeInTheDocument();
    expect(screen.queryByText("Classes")).not.toBeInTheDocument();
  });

  it("abre com o texto do relatório vazio, não com o texto padrão do catálogo", () => {
    // Um legado tira a narrativa do Google Docs. Abrir com o padrão do catálogo
    // e salvar substituiria o texto real do documento por um genérico.
    renderEditor();

    expect(
      screen.queryByDisplayValue(/Este índice mede/u),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("Título da seção 1"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Trazer o texto do Google Docs" }),
    ).toBeInTheDocument();
  });

  it("traz o texto do Google Docs com os colchetes intactos sem gravar nada", async () => {
    vi.mocked(fetch).mockImplementationOnce(() =>
      jsonResponse({
        sections: [
          { title: "Situação atual", text: "Em [municipio]: [valor]." },
        ],
      }),
    );
    renderEditor();

    fireEvent.click(
      screen.getByRole("button", { name: "Trazer o texto do Google Docs" }),
    );

    expect(
      await screen.findByDisplayValue("Em [municipio]: [valor]."),
    ).toBeInTheDocument();
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe(
      "/api/index-catalog/entries/entry-legacy/docs-text",
    );
  });

  it("salva a apresentação na rota do escopo, com a unidade do índice", async () => {
    renderEditor();

    fireEvent.change(screen.getByLabelText("Nome"), {
      target: { value: "Registros de Secas e Estiagens (2004-2024)" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1));
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe(
      "/api/index-catalog/entries/entry-legacy/presentation",
    );
    expect(requestBody(0)).toMatchObject({
      name: "Registros de Secas e Estiagens (2004-2024)",
      measurementUnit: "registros",
      panelPosition: "4",
    });
    expect(
      await screen.findByText(/Publique para que elas apareçam/u),
    ).toBeInTheDocument();
  });

  it("grava o texto do relatório junto quando ele foi editado", async () => {
    vi.mocked(fetch).mockImplementationOnce(() =>
      jsonResponse({ sections: [{ title: "Situação atual", text: "Antes." }] }),
    );
    renderEditor();

    fireEvent.click(
      screen.getByRole("button", { name: "Trazer o texto do Google Docs" }),
    );
    await screen.findByDisplayValue("Antes.");
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalledTimes(3));
    expect(vi.mocked(fetch).mock.calls[2][0]).toBe(
      "/api/index-catalog/drafts/entry-legacy/report-text",
    );
    expect(requestBody(2)).toMatchObject({
      report: {
        schemaVersion: 1,
        sections: [{ title: "Situação atual", text: "Antes." }],
      },
    });
  });

  it("republica o índice já publicado pela rota de ciclo de vida", async () => {
    const { onChanged } = renderEditor();

    fireEvent.click(screen.getByRole("button", { name: "Republicar" }));

    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe(
      "/api/index-catalog/entries/entry-legacy",
    );
    expect(requestBody(0)).toEqual({ action: "publish" });
  });

  it("mostra o erro do servidor sem perder o que estava na tela", async () => {
    vi.mocked(fetch).mockImplementationOnce(() =>
      jsonResponse({ error: "Unidade de medida é obrigatório." }, 400),
    );
    renderEditor();

    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));

    expect(
      await screen.findByText("Unidade de medida é obrigatório."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Unidade de medida")).toHaveValue("registros");
  });
});
