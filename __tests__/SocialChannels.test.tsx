import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import SocialChannels from "@/components/ContactSection/SocialChannels";
import type { SedesChannelI } from "@/utils/interfaces";

const channels: SedesChannelI[] = [
  {
    name: "@observatorio.caatinga",
    href: "https://www.instagram.com/observatorio.caatinga/",
    icon: "instagram",
    size: 32,
  },
];

describe("SocialChannels", () => {
  it("renders one link per channel", () => {
    render(<SocialChannels channels={channels} size={32} />);

    expect(screen.getByRole("link", { name: "" }).getAttribute("href")).toBe(
      "https://www.instagram.com/observatorio.caatinga/",
    );
  });

  // Regressão: com todas as redes comentadas em `@/utils/constants`, o
  // contêiner vazio continuava ocupando um `gap` de 24px na linha do rodapé e
  // empurrava os logos para dentro da margem de 80px que o Figma pede.
  it("renders nothing when there is no channel to show", () => {
    const { container } = render(<SocialChannels channels={[]} size={32} />);

    expect(container).toBeEmptyDOMElement();
  });
});
