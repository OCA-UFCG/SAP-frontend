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

  expect(screen.getByText("O que há de novo?")).toBeDefined();
  expect(screen.getByText("Territórios em destaque")).toBeDefined();
  expect(
    screen.getByText("Como o SEDES apoia o planejamento e a gestão territorial"),
  ).toBeDefined();
  expect(screen.getByText("Um instrumento de política pública")).toBeDefined();
  expect(
    screen.getByText("Quais são as possibilidades de uso do SEDES?"),
  ).toBeDefined();
});
