import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ClassColorField } from "@/components/IndexCatalog/ClassColorField";

const INPUT_CLASS = "campo";

function renderField(color: string, onChange = vi.fn()) {
  const view = render(
    <ClassColorField
      color={color}
      inputClass={INPUT_CLASS}
      label="classe 3"
      onChange={onChange}
    />,
  );
  const hex = screen.getByLabelText("Hexadecimal da classe 3");
  return { ...view, hex, onChange };
}

/**
 * SED-093: na seção CLASSES só existia o `<input type="color">` nativo, que não
 * deixa ler, selecionar, copiar nem colar o hexadecimal — a cor só mudava pelo
 * diálogo do sistema operacional.
 */
describe("ClassColorField", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("mostra o hexadecimal em texto, para poder ser lido e copiado", () => {
    const { hex } = renderField("#CA281B");
    expect(hex).toHaveValue("#CA281B");
  });

  it("aceita um hexadecimal colado e o normaliza antes de gravar", () => {
    const { hex, onChange } = renderField("#CA281B");
    fireEvent.change(hex, { target: { value: "  640e08 " } });
    expect(onChange).toHaveBeenCalledWith("#640E08");
  });

  it("expande a abreviação de três dígitos", () => {
    const { hex, onChange } = renderField("#CA281B");
    fireEvent.change(hex, { target: { value: "#fff" } });
    expect(onChange).toHaveBeenCalledWith("#FFFFFF");
  });

  it("não grava enquanto o valor ainda está incompleto", () => {
    const { hex, onChange } = renderField("#CA281B");
    fireEvent.change(hex, { target: { value: "#CA28" } });
    expect(onChange).not.toHaveBeenCalled();
    expect(hex).toHaveAttribute("aria-invalid", "true");
  });

  it("devolve a última cor válida quando o campo perde o foco inválido", () => {
    const { hex } = renderField("#CA281B");
    fireEvent.change(hex, { target: { value: "banana" } });
    fireEvent.blur(hex);
    expect(hex).toHaveValue("#CA281B");
  });

  it("acompanha a cor escolhida no seletor visual", () => {
    const onChange = vi.fn();
    const { rerender, hex } = renderField("#CA281B", onChange);
    fireEvent.change(screen.getByLabelText("Seletor de cor da classe 3"), {
      target: { value: "#00aa33" },
    });
    expect(onChange).toHaveBeenCalledWith("#00AA33");
    rerender(
      <ClassColorField
        color="#00AA33"
        inputClass={INPUT_CLASS}
        label="classe 3"
        onChange={onChange}
      />,
    );
    expect(hex).toHaveValue("#00AA33");
  });

  it("copia o hexadecimal para a área de transferência", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    const { getByLabelText } = renderField("#CA281B");
    fireEvent.click(getByLabelText("Copiar o hexadecimal da classe 3"));
    expect(writeText).toHaveBeenCalledWith("#CA281B");
  });
});
