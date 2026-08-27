import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import AnalyzeForm from "@/components/Amfe/AnalyzeForm/AnalyzeForm";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/components/Amfe/useCriterias", () => ({
  default: () => ({
    // Deliberately return a new array on every render to guard against the
    // regression that caused the default criteria effect to loop.
    criterias: [
      {
        name: "default-criterion",
        label: "Default criterion",
        is_benefit: true,
        unit: null,
        description: null,
        default: true,
      },
    ],
    loading: false,
    error: null,
  }),
}));

vi.mock("@/components/Amfe/AnalyzeForm/SegmentedSlider", () => ({
  default: ({
    fields,
    setValue,
  }: {
    fields: Array<{ name: string }>;
    setValue: (name: "criteria", value: unknown[]) => void;
  }) => (
    <div>
      <output data-testid="selected-criteria">
        {fields.map((field) => field.name).join(",")}
      </output>
      <button
        type="button"
        onClick={() =>
          setValue("criteria", [
            {
              name: "user-criterion",
              value: 1,
              is_benefit: false,
            },
          ])
        }
      >
        Apply user criterion
      </button>
    </div>
  ),
}));

test("initializes default criteria once and preserves later user selections", async () => {
  render(<AnalyzeForm setFormPayload={vi.fn()} />);

  await waitFor(() => {
    expect(screen.getByTestId("selected-criteria").textContent).toBe(
      "default-criterion",
    );
  });

  fireEvent.click(screen.getByRole("button", { name: "Apply user criterion" }));

  await waitFor(() => {
    expect(screen.getByTestId("selected-criteria").textContent).toBe(
      "user-criterion",
    );
  });
});
