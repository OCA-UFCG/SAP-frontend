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
