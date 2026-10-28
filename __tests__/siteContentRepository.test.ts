import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/infrastructure/contentful/client", () => ({
  CONTENTFUL_COLLECTION_LIMIT: 200,
  getContent: vi.fn(),
}));

import { getContent } from "@/infrastructure/contentful/client";
import {
  getAboutPageContent,
  getHomePageContent,
} from "@/repositories/content/siteContentRepository";

const mockedGetContent = vi.mocked(getContent);

describe("siteContentRepository", () => {
  beforeEach(() => {
    mockedGetContent.mockReset();
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

  it("returns the audience tabs, the team and the partners for the about page, ignoring null entries", async () => {
    mockedGetContent.mockResolvedValue({
      secaoSobreCollection: {
        items: [
          null,
          {
            identifier: "sobre-nos",
            title: "Sobre nós",
            text: { json: { content: [] } },
            image: { url: "//images.ctfassets.net/hero.jpg", title: "Hero" },
            includeInAboutSap: true,
          },
          {
            identifier: "gestao-publica",
            title: "Gestão original",
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
        ],
      },
      aboutCollection: {
        items: [
          null,
          {
            sys: { id: "team-1" },
            title: "Equipe de Desenvolvimento",
            text: { json: { content: [] } },
            image: { url: "/equipe.jpg", title: "Equipe", width: 1, height: 1 },
          },
        ],
      },
      partnersCollection: { items: [null] },
    });

    const about = await getAboutPageContent();

    expect(about?.tabs.map((tab) => tab.identifier)).toEqual([
      "sociedade-e-comunidades",
      "gestao-publica",
    ]);
    expect(about?.team?.title).toBe("Equipe de Desenvolvimento");
    expect(about?.partners).toEqual([]);
  });
});
