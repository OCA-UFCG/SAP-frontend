import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AmfeMapLegend } from "@/components/Amfe/AmfeMapLegend";

describe("AmfeMapLegend", () => {
  it("lists a class for municipalities without data", () => {
    render(<AmfeMapLegend />);

    expect(screen.getAllByRole("listitem").at(-1)).toHaveTextContent("Sem dados");
  });
});
