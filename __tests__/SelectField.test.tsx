import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";

import { SelectField } from "@/components/Amfe/AnalyzeForm/SelectField";

afterEach(() => {
  cleanup();
});

test("esconde a seta nativa e desenha a seta do projeto ao lado do select", () => {
  render(
    <SelectField aria-label="Área" defaultValue="state">
      <option value="state">Estadual</option>
    </SelectField>,
  );

  const select = screen.getByLabelText("Área");

  expect(select.className).toContain("appearance-none");
  expect(
    select.parentElement?.querySelector('use[href="/sprite.svg#chevron-down"]'),
  ).not.toBeNull();
});

test("a seta continua deixando o clique chegar ao select", () => {
  render(
    <SelectField aria-label="Área">
      <option value="state">Estadual</option>
    </SelectField>,
  );

  const icon = screen
    .getByLabelText("Área")
    .parentElement?.querySelector("svg");

  expect(icon?.getAttribute("class")).toContain("pointer-events-none");
});

// A seta do botão Download aparecia escura sobre o fundo verde porque o traço
// estava fixo no sprite. Quem usa o ícone é que escolhe a cor.
test("o chevron do sprite herda a cor de quem o usa", () => {
  const sprite = readFileSync(
    resolve(process.cwd(), "public/sprite.svg"),
    "utf8",
  );
  const symbol = sprite.slice(
    sprite.indexOf('<symbol id="chevron-down"'),
    sprite.indexOf("</symbol>", sprite.indexOf('<symbol id="chevron-down"')),
  );

  expect(symbol).toContain('stroke="currentColor"');
});
