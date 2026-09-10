import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { PanelPositionField } from "@/components/IndexCatalog/PanelPositionField";
import type { IndexCatalogItem } from "@/types/indexCatalog";

function catalogItem(
  entryId: string,
  name: string,
  panelPosition: number,
): IndexCatalogItem {
  return {
    entryId,
    panelLayerId: entryId,
    name,
    description: "",
    category: "Dados Climáticos",
    panelPosition,
    published: true,
    everPublished: true,
    hasUnpublishedChanges: false,
    catalogManaged: true,
    managedScope: "full",
    adoptable: false,
    status: "published",
  };
}

const items = [
  catalogItem("entry-legado", "Monitor de seca | ANA", 0),
  catalogItem("entry-novo", "Monitor de seca | ANA (catálogo)", 15),
];

function renderField(value: string) {
  const onChange = vi.fn();
  render(
    <PanelPositionField
      value={value}
      onChange={onChange}
      items={items}
      entryId="entry-novo"
      category="Dados Climáticos"
      inputClass="input"
    />,
  );
  return { onChange };
}

describe("PanelPositionField", () => {
  afterEach(cleanup);

  it("avisa quem já está na posição pedida e o que a publicação vai fazer", () => {
    renderField("0");

    const warning = screen.getByText(/já está na posição 0/u);
    expect(warning.textContent).toContain("Monitor de seca | ANA");
    expect(warning.textContent).toContain("trocam de lugar");
    // A posição que o ocupante recebe é a que este índice está deixando.
    expect(warning.textContent).toContain("15");
  });

  it("não avisa nada quando a posição está livre", () => {
    renderField("7");

    expect(screen.queryByText(/trocam de lugar/u)).toBeNull();
  });

  it("recusa o que não é uma posição válida sem apagar o que foi digitado", () => {
    const { onChange } = renderField("");
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "-2" },
    });

    expect(onChange).toHaveBeenCalledWith("-2");
    cleanup();
    renderField("-2");
    expect(
      screen.getByText(/número inteiro maior ou igual a zero/u),
    ).toBeTruthy();
  });
});
