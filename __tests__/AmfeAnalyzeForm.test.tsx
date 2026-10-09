import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import AnalyzeForm from "@/components/Amfe/AnalyzeForm/AnalyzeForm";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

afterEach(() => {
  cleanup();
});

const criteriasState = vi.hoisted(() => ({
  loaded: true,
  error: null as string | null,
}));

afterEach(() => {
  criteriasState.loaded = true;
  criteriasState.error = null;
});

vi.mock("@/components/Amfe/useCriterias", () => ({
  default: () => ({
    // Deliberately return a new array on every render to guard against the
    // regression that caused the default criteria effect to loop.
    criterias: criteriasState.loaded
      ? [
          {
            name: "default-criterion",
            label: "Default criterion",
            is_benefit: true,
            unit: null,
            description: null,
            default: true,
          },
        ]
      : [],
    loading: !criteriasState.loaded && !criteriasState.error,
    error: criteriasState.error,
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
      <button type="button" onClick={() => setValue("criteria", [])}>
        Clear criteria
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

test("starts with the pessimistic scenario selected", async () => {
  render(<AnalyzeForm setFormPayload={vi.fn()} />);

  const pessimistic = screen.getByRole("radio", { name: "pessimistic" });
  const optimistic = screen.getByRole("radio", { name: "optimistic" });

  await waitFor(() => {
    expect((pessimistic as HTMLInputElement).checked).toBe(true);
  });
  expect((optimistic as HTMLInputElement).checked).toBe(false);
});

test("keeps advanced settings collapsed until the reader opens them", async () => {
  render(<AnalyzeForm setFormPayload={vi.fn()} />);

  const toggle = screen.getByRole("button", { name: "advancedSettingsTitle" });

  expect(toggle).toHaveAttribute("aria-expanded", "false");

  fireEvent.click(toggle);

  await waitFor(() => {
    expect(toggle).toHaveAttribute("aria-expanded", "true");
  });
});

test("keeps the collapsed advanced settings out of the tab order", () => {
  const { container } = render(<AnalyzeForm setFormPayload={vi.fn()} />);

  const indifference = screen.getByPlaceholderText("indifferencePlaceholder");

  expect(indifference.closest("[inert]")).not.toBeNull();
});

test("opens the advanced settings when a threshold is missing", async () => {
  render(<AnalyzeForm setFormPayload={vi.fn()} />);

  const toggle = screen.getByRole("button", { name: "advancedSettingsTitle" });
  fireEvent.click(toggle);

  const indifference = screen.getByPlaceholderText("indifferencePlaceholder");
  fireEvent.change(indifference, { target: { value: "" } });
  fireEvent.click(toggle);

  await waitFor(() => {
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  fireEvent.click(screen.getByRole("button", { name: "submitButton" }));

  await waitFor(() => {
    expect(toggle).toHaveAttribute("aria-expanded", "true");
  });
  expect(screen.getByText("indifferenceRequired")).toBeTruthy();
});

test("closes the advanced settings on click while an error is still showing", async () => {
  render(<AnalyzeForm setFormPayload={vi.fn()} />);

  const toggle = screen.getByRole("button", { name: "advancedSettingsTitle" });
  fireEvent.click(toggle);

  const indifference = screen.getByPlaceholderText("indifferencePlaceholder");
  fireEvent.change(indifference, { target: { value: "" } });
  fireEvent.click(screen.getByRole("button", { name: "submitButton" }));

  await waitFor(() => {
    expect(screen.getByText("indifferenceRequired")).toBeTruthy();
  });

  fireEvent.click(toggle);

  await waitFor(() => {
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });
});

test("keeps the advanced settings open while the reader fixes the value", async () => {
  render(<AnalyzeForm setFormPayload={vi.fn()} />);

  const toggle = screen.getByRole("button", { name: "advancedSettingsTitle" });
  const indifference = screen.getByPlaceholderText("indifferencePlaceholder");

  fireEvent.change(indifference, { target: { value: "" } });
  fireEvent.click(screen.getByRole("button", { name: "submitButton" }));

  await waitFor(() => {
    expect(toggle).toHaveAttribute("aria-expanded", "true");
  });

  fireEvent.change(indifference, { target: { value: "0.02" } });

  await waitFor(() => {
    expect(screen.queryByText("indifferenceRequired")).toBeNull();
  });
  expect(toggle).toHaveAttribute("aria-expanded", "true");
});

test("keeps Analyze disabled until the criteria catalog arrives", () => {
  criteriasState.loaded = false;
  const setFormPayload = vi.fn();
  render(<AnalyzeForm setFormPayload={setFormPayload} />);

  const submit = screen.getByRole("button", { name: "submitButton" });
  expect(submit).toBeDisabled();

  fireEvent.click(submit);
  expect(setFormPayload).not.toHaveBeenCalled();
});

test("refuses to analyze without any criterion", async () => {
  const setFormPayload = vi.fn();
  render(<AnalyzeForm setFormPayload={setFormPayload} />);

  await waitFor(() => {
    expect(screen.getByTestId("selected-criteria").textContent).toBe(
      "default-criterion",
    );
  });

  fireEvent.click(screen.getByRole("button", { name: "Clear criteria" }));
  fireEvent.click(screen.getByRole("button", { name: "submitButton" }));

  await waitFor(() => {
    expect(screen.getByText("criteriaRequired")).toBeTruthy();
  });
  expect(setFormPayload).not.toHaveBeenCalled();
});

// Sem o catálogo o botão fica desativado; sem este aviso, não havia como saber
// por quê.
test("says why Analyze stays disabled when the criteria fail to load", () => {
  criteriasState.loaded = false;
  criteriasState.error = "fetch failed";
  render(<AnalyzeForm setFormPayload={vi.fn()} />);

  expect(screen.getByText("criteriaLoadError")).toBeTruthy();
  expect(screen.getByRole("button", { name: "submitButton" })).toBeDisabled();
});
