import { beforeEach, describe, expect, it, vi } from "vitest";

// O cliente do Contentful começa com `import "server-only"`, que estoura no
// ambiente jsdom do projeto unitário. Neutralizá-lo é o que permite ler o
// limite do módulo de verdade em vez de repetir o número aqui.
vi.mock("server-only", () => ({}));

// O `getContent` real vai à rede; aqui só interessa o texto da query que ele
// receberia. O limite vem do módulo de verdade para o teste falhar se o valor
// publicado mudar de lugar.
vi.mock("@/infrastructure/contentful/client", async () => {
  const actual = await vi.importActual<
    typeof import("@/infrastructure/contentful/client")
  >("@/infrastructure/contentful/client");
  return { ...actual, getContent: vi.fn() };
});

import {
  CONTENTFUL_COLLECTION_LIMIT,
  getContent,
} from "@/infrastructure/contentful/client";
import {
  getAboutPageContent,
  getFooterContent,
  getGlossaryTerms,
  getHomePageContent,
} from "@/repositories/content/siteContentRepository";
import {
  clearPanelLayersCache,
  getPanelLayerById,
  getPanelLayers,
} from "@/repositories/platform/panelLayerRepository";

const mockedGetContent = vi.mocked(getContent);

/** `xxxCollection(...)` e o que vem entre os parênteses, ou vazio se não houver. */
const COLLECTION_SELECTION_PATTERN =
  /([A-Za-z]+Collection)\s*(?:\(([^)]*)\))?/gu;

function collectionsWithoutLimit(query: string) {
  return [...query.matchAll(COLLECTION_SELECTION_PATTERN)]
    .filter(([, , argumentList]) => !/\blimit\s*:/u.test(argumentList ?? ""))
    .map(([, collection]) => collection);
}

async function sentQueries() {
  mockedGetContent.mockResolvedValue({});
  clearPanelLayersCache();
  await Promise.all([
    getFooterContent(),
    getHomePageContent(),
    getAboutPageContent(),
    getGlossaryTerms(),
    getPanelLayers(),
    getPanelLayerById("CDI_Test"),
  ]);
  return mockedGetContent.mock.calls.map(([query]) => String(query));
}

describe("limite explícito nas consultas de coleção do Contentful", () => {
  beforeEach(() => {
    mockedGetContent.mockReset();
  });

  // Regressão: sete consultas iam sem `limit`, e o Contentful devolve os 100
  // primeiros itens e descarta o resto sem erro nenhum. Nada falhava quando o
  // limite era removido, porque as duas repositories têm o `getContent`
  // mockado e nenhum teste olhava o texto da query.
  it("não deixa nenhuma coleção sair sem limite", async () => {
    const queries = await sentQueries();

    expect(queries.length).toBeGreaterThan(0);
    expect(queries.flatMap(collectionsWithoutLimit)).toEqual([]);
  });

  it("usa o teto publicado nas listas que a plataforma lê inteiras", async () => {
    const queries = await sentQueries();
    const panelLayerQuery = queries.find((query) =>
      query.includes("query GetPanelLayer "),
    );

    expect(panelLayerQuery).toContain(
      `panelLayerCollection(limit: ${CONTENTFUL_COLLECTION_LIMIT})`,
    );
    expect(CONTENTFUL_COLLECTION_LIMIT).toBeGreaterThan(100);
  });
});
