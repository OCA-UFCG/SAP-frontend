import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/IndexCatalog/CatalogMonitoringPreview", () => ({
  CatalogMonitoringPreview: () => <div data-testid="catalog-preview-probe" />,
}));

// A captura tem seus próprios testes; aqui só interessa que a validação a mostre.
vi.mock("@/components/IndexCatalog/CatalogPreviewMapCapture", () => ({
  CatalogPreviewMapCapture: () => (
    <div data-testid="catalog-preview-map-probe" />
  ),
  resolvePreviewMapPeriod: () => "2025",
}));

// Idem para a prévia do relatório: ela faz o seu próprio pedido ao servidor, e
// sem o stub esse pedido consumiria uma das respostas encadeadas dos testes.
vi.mock("@/components/IndexCatalog/CatalogReportPreview", () => ({
  CatalogReportPreview: () => (
    <div data-testid="catalog-report-preview-probe" />
  ),
}));

import { IndexCatalogScreen } from "@/components/IndexCatalog/IndexCatalogScreen";

/**
 * Todas as seções da listagem abrem fechadas, então um teste que inspeciona os
 * cartões de uma delas precisa expandi-la primeiro.
 */
async function expandCatalogSection(title: string) {
  const header = await screen.findByRole("button", {
    name: new RegExp(title, "u"),
  });
  if (header.getAttribute("aria-expanded") === "false") {
    fireEvent.click(header);
  }
}

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
      .mockImplementationOnce(() => jsonResponse({ requiresRepublish: false }))
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

  it("manda a posição na categoria escrita no formulário", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockImplementationOnce(() => jsonResponse({ items: [] }))
      .mockImplementationOnce(() =>
        jsonResponse({ entryId: "draft-1", panelLayerId: "indice-gee" }, 201),
      )
      .mockImplementationOnce(() => jsonResponse({ requiresRepublish: false }))
      .mockImplementationOnce(() => jsonResponse({ items: [] }));

    render(<IndexCatalogScreen />);
    await screen.findByText("Nenhum panelLayer encontrado.");
    fillMinimumForm();
    fireEvent.change(screen.getByLabelText("Posição na categoria"), {
      target: { value: "0" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar rascunho" }));

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(4));
    const body = JSON.parse(
      String((fetchMock.mock.calls[1][1] as RequestInit).body),
    );
    expect(body.panelPosition).toBe(0);
  });

  it("deixa a posição de fora quando o campo fica vazio", async () => {
    // Campo vazio significa "onde já está": mandar zero colocaria todo índice
    // novo brigando pelo primeiro lugar da categoria.
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockImplementationOnce(() => jsonResponse({ items: [] }))
      .mockImplementationOnce(() =>
        jsonResponse({ entryId: "draft-1", panelLayerId: "indice-gee" }, 201),
      )
      .mockImplementationOnce(() => jsonResponse({ requiresRepublish: false }))
      .mockImplementationOnce(() => jsonResponse({ items: [] }));

    render(<IndexCatalogScreen />);
    await screen.findByText("Nenhum panelLayer encontrado.");
    fillMinimumForm();
    fireEvent.click(screen.getByRole("button", { name: "Salvar rascunho" }));

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(4));
    const body = JSON.parse(
      String((fetchMock.mock.calls[1][1] as RequestInit).body),
    );
    expect(body.panelPosition).toBeUndefined();
  });

  it("salva o texto do relatório junto com o rascunho", async () => {
    // Regressão: o texto ficava só no navegador porque "Salvar rascunho" mandava
    // apenas o formulário de dados, e a prévia do relatório caía na frase
    // automática mesmo depois de o operador escrever o texto.
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockImplementationOnce(() => jsonResponse({ items: [] }))
      .mockImplementationOnce(() =>
        jsonResponse({ entryId: "draft-1", panelLayerId: "indice-gee" }, 201),
      )
      .mockImplementationOnce(() => jsonResponse({ requiresRepublish: false }))
      .mockImplementationOnce(() => jsonResponse({ items: [] }));

    render(<IndexCatalogScreen />);
    await screen.findByText("Nenhum panelLayer encontrado.");
    fillMinimumForm();
    fireEvent.change(screen.getAllByLabelText("Texto")[1], {
      target: { value: "TESTE" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar rascunho" }));

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(4));
    const reportCall = fetchMock.mock.calls.find(([url]) =>
      String(url).endsWith("/report-text"),
    );
    expect(reportCall?.[0]).toBe(
      "/api/index-catalog/drafts/draft-1/report-text",
    );
    const body = JSON.parse(String((reportCall?.[1] as RequestInit).body));
    expect(body.report.sections).toContainEqual({
      title: "O que este índice mede",
      text: "TESTE",
    });
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

  it("shows forecast collection fields and opens their contextual guide", async () => {
    render(<IndexCatalogScreen />);
    await screen.findByText("Nenhum panelLayer encontrado.");

    fireEvent.change(screen.getByLabelText("Tipo"), {
      target: { value: "imageCollection" },
    });
    fireEvent.change(screen.getByLabelText("Tratamento da coleção"), {
      target: { value: "latest-emission-leads" },
    });

    expect(screen.getByLabelText("Propriedade da emissão")).toHaveValue(
      "data_emissao",
    );
    expect(screen.getByLabelText("Propriedade do horizonte")).toHaveValue(
      "lead_time",
    );
    expect(screen.getByLabelText("Propriedade do mês previsto")).toHaveValue(
      "system:time_start",
    );
    expect(screen.getByLabelText(/^Horizontes/iu)).toHaveValue("1, 2, 3, 4");

    fireEvent.click(
      screen.getByRole("button", {
        name: "Ajuda sobre previsão por emissão e horizonte",
      }),
    );
    expect(
      screen.getByRole("dialog", {
        name: "Previsão por emissão e horizonte",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "projects/obscaatinga/assets/ColecaoImagens/CPTEC_Prev_T_Anomalia",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/lead 1 → 2026-09/iu)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Entendi" }));
    expect(
      screen.queryByRole("dialog", {
        name: "Previsão por emissão e horizonte",
      }),
    ).not.toBeInTheDocument();
  });

  it("sends forecast properties, leads and thresholds in the draft", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockImplementationOnce(() => jsonResponse({ items: [] }))
      .mockImplementationOnce(() =>
        jsonResponse({ entryId: "draft-forecast" }, 201),
      )
      .mockImplementationOnce(() => jsonResponse({ requiresRepublish: false }))
      .mockImplementationOnce(() => jsonResponse({ items: [] }));

    render(<IndexCatalogScreen />);
    await screen.findByText("Nenhum panelLayer encontrado.");
    fillMinimumForm();
    fireEvent.change(screen.getByLabelText("Tipo"), {
      target: { value: "imageCollection" },
    });
    fireEvent.change(screen.getByLabelText("Tratamento da coleção"), {
      target: { value: "latest-emission-leads" },
    });
    fireEvent.change(screen.getByLabelText(/^Limites das classes/iu), {
      target: { value: "-90, -30, 0, 30, 90" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar rascunho" }));

    await screen.findByText("Rascunho salvo no sistema. Nada foi publicado.");
    const body = JSON.parse(
      String((fetchMock.mock.calls[1][1] as RequestInit).body),
    );
    expect(body.earthEngine).toEqual(
      expect.objectContaining({
        sourceType: "imageCollection",
        thresholds: [-90, -30, 0, 30, 90],
        collectionSelection: {
          type: "latest-emission-leads",
          emissionProperty: "data_emissao",
          leadProperty: "lead_time",
          targetDateProperty: "system:time_start",
          leadValues: [1, 2, 3, 4],
        },
      }),
    );
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
      .mockImplementationOnce(() => jsonResponse({ requiresRepublish: false }))
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
    // A prévia gerada mostra o mapa e também como o índice sairia no relatório.
    expect(
      screen.getByTestId("catalog-report-preview-probe"),
    ).toBeInTheDocument();
    expect(screen.getAllByLabelText("Índice")).toHaveLength(2);
    expect(screen.getByDisplayValue("Classe 0")).toBeInTheDocument();
    expect(fetchMock.mock.calls.map(([url]) => url)).not.toContain(
      "/api/index-catalog/drive-search",
    );
  });

  it("avisa quando a publicação não fica registrada no Contentful", async () => {
    // Regressão: a tela mostrava "Índice publicado no Monitoramento" mesmo
    // quando a entry seguia como rascunho, e só a lista revelava o problema.
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
          classes: [{ id: "classe-0", label: "Classe 0", color: "#D9ED92" }],
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
          classIndexes: [0],
          statisticsAssetCount: 1,
        },
      },
    };
    const draftItem = {
      entryId: "draft-1",
      panelLayerId: "indice-gee",
      name: "Índice GEE",
      description: "Índice classificado",
      published: false,
      everPublished: true,
      hasUnpublishedChanges: false,
      catalogManaged: true,
      status: "ready",
    };
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockImplementationOnce(() => jsonResponse({ items: [] }))
      .mockImplementationOnce(() => jsonResponse({ entryId: "draft-1" }, 201))
      .mockImplementationOnce(() => jsonResponse({ requiresRepublish: false }))
      .mockImplementationOnce(() => jsonResponse({ items: [] }))
      .mockImplementationOnce(() => jsonResponse(preview))
      .mockImplementationOnce(() => jsonResponse({ items: [] }))
      .mockImplementationOnce(() =>
        jsonResponse({
          entryId: "draft-1",
          panelLayerId: "indice-gee",
          status: "published",
        }),
      )
      .mockImplementationOnce(() => jsonResponse({ items: [draftItem] }));

    render(<IndexCatalogScreen />);
    await screen.findByText("Nenhum panelLayer encontrado.");
    fillMinimumForm();
    fireEvent.click(
      screen.getByRole("button", { name: "Validar assets e gerar prévia" }),
    );
    await screen.findByTestId("catalog-preview-probe");
    await screen.findByTestId("catalog-preview-map-probe");

    fireEvent.click(screen.getByRole("button", { name: "Publicar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "continua como rascunho",
    );
    expect(
      screen.queryByText(/Índice publicado no Monitoramento/),
    ).not.toBeInTheDocument();
  });

  it("oferece adoção para o índice legado em vez da mensagem de somente leitura", async () => {
    // Regressão: o cartão dizia "Configuração v1 ou índice externo. Visível,
    // mas não editável por este formulário." e não havia nenhum caminho para
    // editar o que já morava na entry.
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
            managedScope: null,
            adoptable: true,
            status: "legacy",
            catalogConfig: { schemaVersion: 1, panelLayerId: "seca" },
          },
        ],
      }),
    );
    render(<IndexCatalogScreen />);
    await expandCatalogSection("Legados fora do catálogo");
    expect(
      await screen.findByRole("button", { name: "Adotar no catálogo" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/não editável por este formulário/u),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Abrir e editar" }),
    ).not.toBeInTheDocument();
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
  });

  it("oferece Republicar no índice publicado com alteração pendente", async () => {
    // Regressão: o cartão de um índice v2 publicado só tinha "Despublicar".
    // Depois de salvar o texto do relatório, a tela pedia para publicar de novo
    // e não havia botão para isso — a saída era tirar o índice do ar e
    // republicá-lo.
    vi.mocked(fetch).mockImplementationOnce(() =>
      jsonResponse({
        items: [
          {
            entryId: "v2",
            panelLayerId: "indice-gee",
            name: "Índice GEE",
            description: "",
            published: true,
            everPublished: true,
            hasUnpublishedChanges: true,
            catalogManaged: true,
            managedScope: "full",
            adoptable: false,
            status: "published",
          },
        ],
      }),
    );
    render(<IndexCatalogScreen />);
    await expandCatalogSection("Publicados");

    expect(
      await screen.findByRole("button", { name: "Republicar" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Despublicar" }),
    ).toBeInTheDocument();
  });

  it("não oferece Republicar quando não há alteração pendente", async () => {
    vi.mocked(fetch).mockImplementationOnce(() =>
      jsonResponse({
        items: [
          {
            entryId: "v2",
            panelLayerId: "indice-gee",
            name: "Índice GEE",
            description: "",
            published: true,
            everPublished: true,
            hasUnpublishedChanges: false,
            catalogManaged: true,
            managedScope: "full",
            adoptable: false,
            status: "published",
          },
        ],
      }),
    );
    render(<IndexCatalogScreen />);
    await expandCatalogSection("Publicados");

    expect(
      await screen.findByRole("button", { name: "Despublicar" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Republicar" }),
    ).not.toBeInTheDocument();
  });

  it("não oferece Republicar quando a edição do rascunho apagou a prévia", async () => {
    // O `PUT` do rascunho derruba o status para "draft" e apaga a validação, e
    // a rota de publicação recusa esse estado. Oferecer "Republicar" aqui só
    // levaria a um "Revalide os assets" depois do clique, sem nada na tela para
    // o operador corrigir.
    vi.mocked(fetch).mockImplementationOnce(() =>
      jsonResponse({
        items: [
          {
            entryId: "v2",
            panelLayerId: "indice-gee",
            name: "Índice GEE",
            description: "",
            published: true,
            everPublished: true,
            hasUnpublishedChanges: true,
            catalogManaged: true,
            managedScope: "full",
            adoptable: false,
            status: "draft",
          },
        ],
      }),
    );
    render(<IndexCatalogScreen />);
    await expandCatalogSection("Publicados");

    expect(
      await screen.findByRole("button", { name: "Despublicar" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Republicar" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("Publicado com revisão em rascunho"),
    ).toBeInTheDocument();
  });

  it("não oferece adoção quando o imageData ainda é pré-compacto", async () => {
    vi.mocked(fetch).mockImplementationOnce(() =>
      jsonResponse({
        items: [
          {
            entryId: "legacy",
            panelLayerId: "veg",
            name: "Vegetação Nativa",
            description: "",
            published: false,
            hasUnpublishedChanges: false,
            catalogManaged: false,
            managedScope: null,
            adoptable: false,
            adoptionBlockedReason:
              "O imageData desta entry ainda está no formato pré-compacto (imageParams por ano). Converta para territorial-compact antes de adotar.",
            status: "legacy",
          },
        ],
      }),
    );
    render(<IndexCatalogScreen />);
    await expandCatalogSection("Legados fora do catálogo");
    expect(
      await screen.findByText(/formato pré-compacto/u),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Adotar no catálogo" }),
    ).not.toBeInTheDocument();
  });

  it("abre o índice v2 mesmo com um índice legado adotado já aberto", async () => {
    // Regressão: o formulário do catálogo só é renderizado quando não há índice
    // legado aberto, e `resumeDraft` não fechava o editor legado. Com um índice
    // adotado aberto, clicar em "Abrir e editar" num índice v2 carregava o
    // rascunho numa seção invisível e o botão parecia não funcionar.
    vi.mocked(fetch).mockImplementationOnce(() =>
      jsonResponse({
        items: [
          {
            entryId: "adotado",
            panelLayerId: "s2id_secas_estiagens",
            name: "Secas e Estiagens",
            description: "Ocorrências registradas no S2iD.",
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
              name: "Secas e Estiagens",
              description: "Ocorrências registradas no S2iD.",
              category: "Dados Climáticos",
            },
          },
          {
            entryId: "v2",
            panelLayerId: "indice-gee",
            name: "Índice GEE",
            description: "Índice classificado",
            published: false,
            everPublished: false,
            hasUnpublishedChanges: true,
            catalogManaged: true,
            managedScope: "full",
            adoptable: false,
            status: "draft",
            catalogConfig: {
              schemaVersion: 2,
              managedScope: "full",
              panelLayerId: "indice-gee",
              status: "draft",
              name: "Índice GEE",
              description: "Índice classificado",
              category: "Dados Climáticos",
              statisticsSource: {
                asset: {
                  type: "fixed",
                  assetId: "projects/example/assets/statistics",
                },
              },
              classes: [],
              earthEngine: { assetId: "projects/example/assets/map" },
            },
          },
        ],
      }),
    );
    render(<IndexCatalogScreen />);
    await expandCatalogSection("Publicados");
    await expandCatalogSection("Não publicados");

    const legacyCard = (await screen.findByText("Secas e Estiagens")).closest(
      "article",
    ) as HTMLElement;
    fireEvent.click(
      within(legacyCard).getByRole("button", { name: "Abrir e editar" }),
    );
    expect(await screen.findByText("Editar índice legado")).toBeInTheDocument();

    const v2Card = screen
      .getByText("Índice GEE")
      .closest("article") as HTMLElement;
    fireEvent.click(
      within(v2Card).getByRole("button", { name: "Abrir e editar" }),
    );

    expect(await screen.findByText("Editar índice")).toBeInTheDocument();
    expect(screen.queryByText("Editar índice legado")).not.toBeInTheDocument();
    expect(screen.getByDisplayValue("Índice GEE")).toBeInTheDocument();
  });
});
