import { render, screen } from "@testing-library/react";
import { vi, test, expect } from "vitest";
import Home from "../src/app/[locale]/page";

// Mock do next/image
vi.mock("next/image", () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt="" {...props} />
  ),
}));

// As prévias borradas das fotos vêm do Contentful; aqui a home fica sem elas.
vi.mock("@/services/blurPreviews", () => ({
  getBlurPreviews: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/infrastructure/contentful/client", () => ({
  CONTENTFUL_COLLECTION_LIMIT: 200,
  getContent: vi.fn().mockResolvedValue({
    aboutCollection: {
      items: [
        {
          title: "Sobre Nós",
          text: {
            json: {
              content: [],
            },
          },
          image: { url: "https://example.com/image.png" },
        },
      ],
    },
  }),
}));

test("Home", async () => {
  const HomeResolved = await Home({ params: Promise.resolve({ locale: "pt" }) });
  render(HomeResolved);

  // Sem os textos no Contentful, a home usa as traduções em português.
  expect(screen.getByText("Recursos em destaque")).toBeDefined();
  expect(screen.getByText("Seca em uma só classificação")).toBeDefined();
  expect(screen.getByText("O que você pode fazer no SEDES")).toBeDefined();
  expect(screen.getByText("Um instrumento de política pública")).toBeDefined();
  expect(screen.getByText("O que dizem sobre o SEDES")).toBeDefined();
  expect(screen.getByText("Previsto em lei")).toBeDefined();
});
