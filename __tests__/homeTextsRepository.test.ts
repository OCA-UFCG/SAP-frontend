import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/infrastructure/contentful/client", () => ({
  CONTENTFUL_COLLECTION_LIMIT: 200,
  getContent: vi.fn(),
}));

import { getContent } from "@/infrastructure/contentful/client";
import { getHomeTexts } from "@/repositories/content/homeTextsRepository";

const mockedGetContent = vi.mocked(getContent);

describe("getHomeTexts", () => {
  beforeEach(() => {
    mockedGetContent.mockReset();
  });

  it("maps the Contentful entries to the home texts", async () => {
    mockedGetContent.mockResolvedValue({
      homeSectionCollection: {
        items: [
          {
            identifier: "politica-publica",
            title: "Um instrumento de política pública",
            subtitle: null,
            text: "O SEDES é o sistema...",
            buttonText: "Conheça o SEDES",
            imagesCollection: {
              items: [
                { url: "https://img/c1.jpg" },
                null,
                { url: "https://img/c3.jpg" },
              ],
            },
          },
        ],
      },
      homeHighlightCollection: {
        items: [{ value: "5.570", label: "Municípios", description: "d" }],
      },
      homeToolCollection: {
        items: [
          {
            tool: "priorizacao",
            name: "Priorização",
            shortText: "curto",
            fullText: null,
            buttonText: "Explore a Priorização",
            image: { url: "https://img/priorizacao.jpg" },
          },
          {
            tool: "outra",
            name: "Ferramenta desconhecida",
            shortText: "x",
            buttonText: "x",
          },
        ],
      },
      homeFeatureCollection: {
        items: [
          {
            sys: { id: "f1" },
            tool: "comunicacao",
            title: "Relatório",
            description: "d",
            link: null,
            date: null,
          },
          {
            sys: { id: "f2" },
            tool: "monitoramento",
            title: "CDI",
            description: "d",
            link: "/platform?layer=cdi",
            date: "2026-11-10T00:00:00.000-03:00",
          },
        ],
      },
      homeTestimonialCollection: {
        items: [
          { quote: "Citação", author: "Pesquisador", authorDetail: null },
        ],
      },
    });

    const texts = await getHomeTexts();

    expect(texts?.sections).toEqual({
      "politica-publica": {
        title: "Um instrumento de política pública",
        subtitle: undefined,
        text: "O SEDES é o sistema...",
        buttonText: "Conheça o SEDES",
        // Foto despublicada chega como null e sai da lista.
        images: ["https://img/c1.jpg", "https://img/c3.jpg"],
      },
    });
    expect(texts?.highlights).toHaveLength(1);
    // Ferramenta fora da lista não tem foto nem link no código: fica de fora.
    expect(texts?.tools).toEqual([
      {
        id: "analysis",
        name: "Priorização",
        shortText: "curto",
        fullText: undefined,
        buttonText: "Explore a Priorização",
        image: "https://img/priorizacao.jpg",
      },
    ]);
    expect(texts?.features).toEqual([
      {
        id: "f1",
        module: "communication",
        title: "Relatório",
        description: "d",
        // Sem link próprio, o card leva à ferramenta.
        href: "/platform?section=communication",
        date: undefined,
      },
      {
        id: "f2",
        module: "monitoring",
        title: "CDI",
        description: "d",
        href: "/platform?layer=cdi",
        date: "2026-11-10",
      },
    ]);
    expect(texts?.testimonials).toEqual([
      { quote: "Citação", author: "Pesquisador", authorDetail: undefined },
    ]);
  });

  it("returns null when Contentful fails, so the page keeps the translations", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    mockedGetContent.mockRejectedValue(new Error("Contentful unavailable"));

    expect(await getHomeTexts()).toBeNull();

    consoleErrorSpy.mockRestore();
  });
});
