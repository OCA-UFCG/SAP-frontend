import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useForm } from "react-hook-form";

import InputForm from "@/components/Amfe/AnalyzeForm/InputForm";
import { AnalyzeFormData } from "@/utils/amfeInterfaces";

const ThresholdFormHarness = ({
  onSubmitted,
  type = "number",
}: {
  onSubmitted: (data: AnalyzeFormData) => void;
  type?: string;
}) => {
  const {
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<AnalyzeFormData>();

  return (
    <form onSubmit={handleSubmit(onSubmitted)}>
      <InputForm
        error={errors.indifference?.message as string}
        fieldLabel="Indiferença"
        inputProps={{ type, step: 0.01, "aria-label": "indifference" }}
        formProps={{
          name: "indifference",
          control,
          rules: { required: "campo obrigatório" },
        }}
      />
      <button type="submit">enviar</button>
    </form>
  );
};

beforeEach(() => {
  cleanup();
});

describe("InputForm", () => {
  it("stores an edited threshold as a number, so the XLSX cell is numeric", async () => {
    const onSubmitted = vi.fn();
    render(<ThresholdFormHarness onSubmitted={onSubmitted} />);

    fireEvent.change(screen.getByLabelText("indifference"), {
      target: { value: "0.35" },
    });
    fireEvent.click(screen.getByText("enviar"));

    await vi.waitFor(() => expect(onSubmitted).toHaveBeenCalled());
    expect(onSubmitted.mock.calls[0][0].indifference).toBe(0.35);
  });

  it("leaves a text field alone instead of coercing everything to a number", async () => {
    const onSubmitted = vi.fn();
    render(<ThresholdFormHarness onSubmitted={onSubmitted} type="text" />);

    fireEvent.change(screen.getByLabelText("indifference"), {
      target: { value: "0.35" },
    });
    fireEvent.click(screen.getByText("enviar"));

    await vi.waitFor(() => expect(onSubmitted).toHaveBeenCalled());
    expect(onSubmitted.mock.calls[0][0].indifference).toBe("0.35");
  });

  it("keeps an emptied number field falsy so `required` still fires", async () => {
    const onSubmitted = vi.fn();
    render(<ThresholdFormHarness onSubmitted={onSubmitted} />);

    const input = screen.getByLabelText("indifference");
    fireEvent.change(input, { target: { value: "0.35" } });
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.click(screen.getByText("enviar"));

    await screen.findByText("campo obrigatório");
    expect(onSubmitted).not.toHaveBeenCalled();
  });
});
