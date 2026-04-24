import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/infrastructure/contentful/client", () => ({
  getContent: vi.fn(),
}));

import { getContent } from "@/infrastructure/contentful/client";
import {
  getAboutPageContent,
  getFooterContent,
  getHomePageContent,
} from "@/repositories/content/siteContentRepository";

const mockedGetContent = vi.mocked(getContent);

describe("siteContentRepository", () => {
  beforeEach(() => {
    mockedGetContent.mockReset();
  });

  it("maps footer entries to the footer contract used by the layout", async () => {
    mockedGetContent.mockResolvedValue({
      footerCollection: {
        items: [
          {
            sys: { id: "footer-1" },
            name: "Contato",
            path: "/contact",
            appears: true,
          },
        ],
      },
    });

    const footer = await getFooterContent();

    expect(footer).toEqual([
      {
        id: "footer-1",
        name: "Contato",
        path: "/contact",
        appears: true,
      },
    ]);
  });

  it("returns an empty footer when the CMS request fails", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    mockedGetContent.mockRejectedValue(new Error("Contentful unavailable"));

    const footer = await getFooterContent();

    expect(footer).toEqual([]);

    consoleErrorSpy.mockRestore();
  });

  it("ignores null footer items returned by Contentful", async () => {
    mockedGetContent.mockResolvedValue({
      footerCollection: {
        items: [
          null,
          {
            sys: { id: "footer-1" },
            name: "Contato",
            path: "/contact",
            appears: true,
          },
        ],
      },
    });

    const footer = await getFooterContent();

    expect(footer).toEqual([
      {
        id: "footer-1",
        name: "Contato",
        path: "/contact",
        appears: true,
      },
    ]);
  });

  it("returns home tabs in the page order instead of the CMS order", async () => {
    mockedGetContent.mockResolvedValue({
      bannerCollection: { items: [] },
      aboutCollection: { items: [] },
      cabealhoSeesCollection: { items: [] },
      partnersCollection: { items: [] },
      secaoSobreCollection: {
        items: [
          {
            identifier: "gestao-publica",
            title: "Gestão pública original",
            text: { json: { content: [] } },
            image: { url: "/gestao.png", title: "Gestão" },
            includeInAboutSap: false,
          },
          {
            identifier: "sociedade-e-comunidades",
            title: "Sociedade original",
            text: { json: { content: [] } },
            image: { url: "/sociedade.png", title: "Sociedade" },
            includeInAboutSap: false,
          },
          {
            identifier: "tecnicos-e-pesquisadores",
            title: "Técnicos original",
            text: { json: { content: [] } },
            image: { url: "/tecnicos.png", title: "Técnicos" },
            includeInAboutSap: false,
          },
        ],
      },
    });

    const content = await getHomePageContent();

    expect(content?.tabs.map((tab) => tab.identifier)).toEqual([
      "sociedade-e-comunidades",
      "tecnicos-e-pesquisadores",
      "gestao-publica",
    ]);
    expect(content?.tabs.map((tab) => tab.title)).toEqual([
      "Sociedade e comunidades",
      "Técnicos e pesquisadores",
      "Gestão pública",
    ]);
  });

  it("ignores null tab entries from Contentful while preserving expected tab order", async () => {
    mockedGetContent.mockResolvedValue({
      bannerCollection: { items: [] },
      aboutCollection: { items: [] },
      cabealhoSeesCollection: { items: [] },
      partnersCollection: { items: [] },
      secaoSobreCollection: {
        items: [
          null,
          {
            identifier: "tecnicos-e-pesquisadores",
            title: "Técnicos original",
            text: { json: { content: [] } },
            image: { url: "/tecnicos.png", title: "Técnicos" },
            includeInAboutSap: false,
          },
          {
            identifier: "sociedade-e-comunidades",
            title: "Sociedade original",
            text: { json: { content: [] } },
            image: { url: "/sociedade.png", title: "Sociedade" },
            includeInAboutSap: false,
          },
        ],
      },
    });

    const content = await getHomePageContent();

    expect(content?.tabs.map((tab) => tab.identifier)).toEqual([
      "sociedade-e-comunidades",
      "tecnicos-e-pesquisadores",
    ]);
  });

  it("ignores null about sections from Contentful and still maps known sections", async () => {
    mockedGetContent.mockResolvedValue({
      secaoSobreCollection: {
        items: [
          null,
          {
            sys: { id: "hero-1" },
            identifier: "sobre-nos",
            title: "Sobre nós",
            text: { json: { content: [] } },
            image: { url: "//images.ctfassets.net/hero.jpg", title: "Hero" },
          },
          {
            sys: { id: "seca-1" },
            identifier: "sobre-seca",
            title: "Sobre a seca",
            text: { json: { content: [] } },
            image: { url: "//images.ctfassets.net/seca.jpg", title: "Seca" },
          },
        ],
      },
      cabealhoSeesCollection: {
        items: [
          { sys: { id: "header-1" }, title: "Parceiros", description: "Desc" },
        ],
      },
      partnersCollection: { items: [] },
    });

    const about = await getAboutPageContent();

    expect(about?.hero?.title).toBe("Sobre nós");
    expect(about?.aboutSections.map((section) => section.title)).toEqual([
      "Sobre a seca",
    ]);
  });
});
