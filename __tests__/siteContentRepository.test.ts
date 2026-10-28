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

  it("groups the about page blocks by section and splits their items by type", async () => {
    mockedGetContent.mockResolvedValue({
      planoAcaoBrasileiroCollection: {
        items: [
          null,
          {
            identifier: "topo",
            title: "Sobre Nós",
            text: { json: { content: [] } },
            imagesCollection: {
              items: [{ url: "/a.jpg", title: "A" }, null, { url: "/c.jpg", title: null }],
            },
            itemsCollection: { items: [] },
          },
          {
            identifier: "pab",
            title: "O PAB-Brasil",
            text: null,
            imagesCollection: { items: [] },
            itemsCollection: {
              items: [
                { __typename: "StatCard", label: "Pessoas beneficiadas", value: "39 Milhões" },
                null,
              ],
            },
          },
          {
            identifier: "eixos",
            title: "Eixos",
            imagesCollection: null,
            itemsCollection: {
              items: [
                {
                  __typename: "Projects",
                  title: "Pesquisa",
                  description: null,
                  actionsCount: 38,
                  executor: "MMA",
                  executorActionsCount: 12,
                  partners: null,
                  isSedesAxis: true,
                },
              ],
            },
          },
          {
            identifier: "para-quem",
            title: "Para quem é o SEDES?",
            imagesCollection: { items: [] },
            itemsCollection: {
              items: [
                {
                  __typename: "SecaoSobre",
                  identifier: "gestao-publica",
                  title: "Gestão pública",
                  text: { json: { content: [] } },
                  image: { url: "/gestao.jpg", title: "Gestão" },
                  includeInAboutSap: false,
                },
              ],
            },
          },
        ],
      },
      partnersCollection: { items: [null] },
    });

    const about = await getAboutPageContent();

    expect(Object.keys(about?.sections ?? {})).toEqual(["topo", "pab", "eixos", "para-quem"]);
    expect(about?.sections.topo?.images).toEqual([
      { url: "/a.jpg", title: "A" },
      { url: "/c.jpg", title: undefined },
    ]);
    expect(about?.sections.pab?.text).toBeUndefined();
    expect(about?.sections.pab?.pairs).toEqual([
      { label: "Pessoas beneficiadas", value: "39 Milhões" },
    ]);
    expect(about?.sections.eixos?.axes[0]).toMatchObject({
      partners: [],
      isSedesAxis: true,
      description: undefined,
    });
    expect(about?.sections["para-quem"]?.tabs).toEqual([
      {
        identifier: "gestao-publica",
        title: "Gestão pública",
        text: { json: { content: [] } },
        image: { url: "/gestao.jpg", title: "Gestão" },
        includeInAboutSap: false,
      },
    ]);
    expect(about?.partners).toEqual([]);
  });
});
