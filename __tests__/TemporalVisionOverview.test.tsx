import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TemporalVision } from "@/components/analysis/TemporalVision";
import type { CompactAnalysisYearData } from "@/utils/analysis";

afterEach(cleanup);

const classes = [
  { id: "1", label: "Floresta", color: "#2E7D32" },
  { id: "2", label: "Pastagem", color: "#FFFFFF" },
];

function annualYears(count: number) {
  const years: Record<string, CompactAnalysisYearData> = {};
  for (let index = 0; index < count; index += 1) {
    years[String(2010 + index)] = {
      valuesScale: 1,
      values: { br: [60 - index, 40 + index] },
    };
  }
  return years;
}

describe("mini-mapa da Visão temporal", () => {
  it("não aparece quando a série cabe inteira", () => {
    render(<TemporalVision years={annualYears(6)} classes={classes} />);
    expect(screen.queryByRole("slider")).toBeNull();
  });

  it("abre nos últimos 8 anos e anda com as setas do teclado", () => {
    render(<TemporalVision years={annualYears(12)} classes={classes} />);
    const slider = screen.getByRole("slider", {
      name: "Período exibido no gráfico",
    });
    expect(slider.getAttribute("aria-valuetext")).toBe("2014 – 2021");
    expect(screen.getByText("2014 – 2021")).toBeTruthy();

    fireEvent.keyDown(slider, { key: "ArrowLeft" });
    expect(slider.getAttribute("aria-valuetext")).toBe("2013 – 2020");

    fireEvent.keyDown(slider, { key: "Home" });
    expect(slider.getAttribute("aria-valuetext")).toBe("2010 – 2017");

    fireEvent.keyDown(slider, { key: "End" });
    expect(slider.getAttribute("aria-valuetext")).toBe("2014 – 2021");
  });

  it("desenha uma linha por série num índice em valor", () => {
    render(
      <TemporalVision
        years={annualYears(12)}
        classes={classes.slice(0, 1)}
        valueType="absolute"
        valueUnit="de reais"
      />,
    );
    const slider = screen.getByRole("slider");
    expect(slider.querySelectorAll("path").length).toBe(1);
  });
});
