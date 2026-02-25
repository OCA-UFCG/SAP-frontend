import { render, screen } from "@testing-library/react";
import { vi, test, expect } from "vitest";
import Home from "../src/app/page";

// Mock do next/image
vi.mock("next/image", () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => (
    <img alt="" {...props} />
  ),
}));

vi.mock("@/utils/contentful", () => ({
  getContent: vi.fn().mockResolvedValue({
    aboutCollection: {
      items: [
        {
          title: "Sobre Nós",
          text: {
            json: {
              nodeType: "document",
              data: {},
              content: [
                {
                  nodeType: "paragraph",
                  data: {},
                  content: [
                    {
                      nodeType: "text",
                      value: "Test content",
                      marks: [],
                      data: {},
                    },
                  ],
                },
              ],
            },
          },
          image: { url: "https://example.com/image.png" },
        },
      ],
    },
  }),
}));

test("Home", async () => {
  const HomeResolved = await Home();
  render(HomeResolved);

  expect(screen.getByText("Sobre Nós")).toBeDefined();
});
