import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import CriteriaModal from "@/components/Amfe/CriteriaModal/CriteriaModal";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: { name?: string }) => {
    if (key === "infoAriaLabel") {
      return `Informações sobre ${values?.name}`;
    }

    return key;
  },
}));

test("shows the criterion description when the info icon is hovered", () => {
  const description = "Descrição fornecida pelo manifesto do dataset.";

  render(
    <CriteriaModal
      options={[
        {
          id: "criterion",
          name: "Critério",
          description,
        },
      ]}
    >
      {(open) => <button onClick={open}>Abrir</button>}
    </CriteriaModal>,
  );

  fireEvent.click(screen.getByRole("button", { name: "Abrir" }));
  expect(screen.queryByText(description)).toBeNull();

  fireEvent.mouseEnter(
    screen.getByRole("button", { name: "Informações sobre Critério" }),
  );

  expect(screen.getByText(description)).toBeTruthy();
});

test("opens the first tooltips below the search field", () => {
  const options = ["Primeiro", "Segundo", "Terceiro"].map((name, index) => ({
    id: String(index),
    name,
    description: `Descrição ${name}`,
  }));

  render(
    <CriteriaModal options={options}>
      {(open) => <button onClick={open}>Abrir opções</button>}
    </CriteriaModal>,
  );

  fireEvent.click(screen.getByRole("button", { name: "Abrir opções" }));
  fireEvent.mouseEnter(
    screen.getByRole("button", { name: "Informações sobre Primeiro" }),
  );

  const tooltip = screen.getByText("Descrição Primeiro").parentElement;
  expect(tooltip?.getAttribute("role")).toBe("tooltip");
  expect(tooltip?.className).toContain("top-[calc(100%+10px)]");
});

test("draws its icons from the shared platform sprite symbols", () => {
  render(
    <CriteriaModal options={[{ id: "criterion", name: "Critério" }]}>
      {(open) => <button onClick={open}>Abrir sprite</button>}
    </CriteriaModal>,
  );

  fireEvent.click(screen.getByRole("button", { name: "Abrir sprite" }));

  // O modal vai para um portal, então os ícones não ficam sob o container.
  const symbols = Array.from(document.body.querySelectorAll("use")).map(
    (node) => node.getAttribute("href"),
  );

  // O SAP-amfe trouxe closeIcon/infoIcon/searchIcon duplicando símbolos que a
  // plataforma já tinha. Se voltarem, este teste falha.
  expect(symbols).toContain("/sprite.svg#close-modal");
  expect(symbols).toContain("/sprite.svg#info");
  expect(symbols).toContain("/sprite.svg#loupe");
  expect(symbols.join(",")).not.toMatch(/closeIcon|infoIcon|searchIcon/);
});

test("lays the criteria out in a three column grid", () => {
  render(
    <CriteriaModal options={[{ id: "criterion", name: "Grade" }]}>
      {(open) => <button onClick={open}>Abrir grade</button>}
    </CriteriaModal>,
  );

  fireEvent.click(screen.getByRole("button", { name: "Abrir grade" }));

  const grid = screen.getByText("Grade").closest("div")?.parentElement;
  expect(grid?.className).toContain("grid-cols-1");
  expect(grid?.className).toContain("sm:grid-cols-3");
});

test("opens the last column tooltip towards the left so it stays inside the modal", () => {
  const options = ["Alfa", "Beta", "Gama"].map((name, index) => ({
    id: String(index),
    name,
    description: `Descrição ${name}`,
  }));

  render(
    <CriteriaModal options={options}>
      {(open) => <button onClick={open}>Abrir alinhamento</button>}
    </CriteriaModal>,
  );

  fireEvent.click(screen.getByRole("button", { name: "Abrir alinhamento" }));

  fireEvent.mouseEnter(
    screen.getByRole("button", { name: "Informações sobre Alfa" }),
  );
  expect(screen.getByText("Descrição Alfa").parentElement?.className).toContain(
    "left-[-26px]",
  );

  fireEvent.mouseEnter(
    screen.getByRole("button", { name: "Informações sobre Gama" }),
  );
  expect(screen.getByText("Descrição Gama").parentElement?.className).toContain(
    "right-[-26px]",
  );
});
