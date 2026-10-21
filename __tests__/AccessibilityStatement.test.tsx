import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import ptAccessibility from "@/translations/pt/Accessibility.json";
import enAccessibility from "@/translations/en/Accessibility.json";
import esAccessibility from "@/translations/es/Accessibility.json";
import { sedesEmail } from "@/utils/constants";

type Messages = { [key: string]: string | Messages };

function lookup(messages: Messages, path: string): string {
  const value = path
    .split(".")
    .reduce<string | Messages | undefined>(
      (node, key) => (typeof node === "object" ? node[key] : undefined),
      messages,
    );
  if (typeof value !== "string") {
    throw new Error(`missing message "${path}", expected a string`);
  }
  return value;
}

/**
 * O `useTranslations` com `rich`, que o mock global de `next-intl` não tem.
 * Troca `{valor}` e transforma `<tag>texto</tag>` no elemento da tag.
 */
class FakeRichTranslations {
  static for(namespace: string) {
    const messages = ptAccessibility as unknown as Messages;
    const t = (key: string) => lookup(messages, `${namespace}.${key}`);
    t.rich = (
      key: string,
      values: Record<string, string | ((chunks: ReactNode) => ReactNode)>,
    ) =>
      t(key)
        .split(/(<\w+>.*?<\/\w+>)/)
        .map((part, index) => {
          const tag = part.match(/^<(\w+)>(.*)<\/\w+>$/);
          const fill = (text: string) =>
            text.replace(/\{(\w+)\}/g, (_, name) => String(values[name]));
          if (!tag) return fill(part);
          const render = values[tag[1]] as (chunks: ReactNode) => ReactNode;
          return <span key={index}>{render(fill(tag[2]))}</span>;
        });
    return t;
  }
}

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => FakeRichTranslations.for(namespace),
}));

import { AccessibilityStatement } from "@/components/AccessibilityStatement/AccessibilityStatement";

afterEach(cleanup);

describe("AccessibilityStatement", () => {
  it("states the commitment to the LBI under the page heading", () => {
    render(<AccessibilityStatement />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Acessibilidade" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Lei nº 13\.146\/2015/)).toBeInTheDocument();
  });

  // A tabela vem das mesmas constantes da barra do topo: se uma tecla mudar
  // lá, a página não pode continuar prometendo a antiga.
  it("lists the eMAG access keys used by the shortcut bar", () => {
    render(<AccessibilityStatement />);

    const rows = within(screen.getByRole("table")).getAllByRole("row");
    const keys = rows.slice(1).map((row) => row.querySelector("kbd")?.textContent);

    expect(keys).toEqual(["1", "2", "3", "4"]);
  });

  it("gives an e-mail to report a barrier", () => {
    render(<AccessibilityStatement />);

    const link = screen.getByRole("link", { name: sedesEmail });

    expect(link).toHaveAttribute("href", `mailto:${sedesEmail}`);
  });

  it("has the same texts in the three languages", () => {
    const keys = (messages: Messages, prefix = ""): string[] =>
      Object.entries(messages).flatMap(([key, value]) =>
        typeof value === "string"
          ? [`${prefix}${key}`]
          : keys(value, `${prefix}${key}.`),
      );
    const pt = keys(ptAccessibility as unknown as Messages);

    expect(keys(enAccessibility as unknown as Messages)).toEqual(pt);
    expect(keys(esAccessibility as unknown as Messages)).toEqual(pt);
  });
});
