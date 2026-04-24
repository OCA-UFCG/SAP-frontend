import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/infrastructure/contentful/client", () => ({
  getContent: vi.fn(),
}));

import { getContent } from "@/infrastructure/contentful/client";
import {
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
});
