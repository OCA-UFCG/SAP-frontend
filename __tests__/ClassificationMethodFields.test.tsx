import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ClassificationMethodFields } from "@/components/IndexCatalog/ClassificationMethodFields";
import type { DraftClassificationSample } from "@/types/indexCatalog";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const SAMPLE: DraftClassificationSample = {
  origin: "spreadsheet",
  period: "2024",
  values: Array.from({ length: 101 }, (_value, index) => index),
  count: 101,
  min: 0,
  max: 100,
  mean: 50,
  standardDeviation: 29.15,
};

/** Responde à rota da amostra sem tocar a rede, como o servidor responderia. */
function stubSampleRequest(sample: DraftClassificationSample = SAMPLE) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ sample }),
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderFields(
  overrides: Partial<Parameters<typeof ClassificationMethodFields>[0]> = {},
) {
  const onApply = vi.fn();
  const { classCount: initialClassCount = 4, ...rest } = overrides;
  const fields = (classCount: number) => (
    <ClassificationMethodFields
      entryId="entry-1"
      periods={["2024", "2023"]}
      classCount={classCount}
      canChangeClassCount
      inputClass=""
      buttonClass=""
      onApply={onApply}
      {...rest}
    />
  );
  const view = render(fields(initialClassCount));
  return { onApply, rerender: (count: number) => view.rerender(fields(count)) };
}

async function loadSample() {
  fireEvent.click(screen.getByText("Ler os valores do período"));
  await waitFor(() => screen.getByLabelText(/Método/u));
}

describe("ClassificationMethodFields", () => {
  it("lê a amostra do período escolhido e resume o que veio", async () => {
    const fetchMock = stubSampleRequest();
    renderFields();

    await loadSample();

    expect(fetchMock.mock.calls[0][0]).toContain(
      "/api/index-catalog/drafts/entry-1/classification-sample?year=2024",
    );
    expect(screen.getByText(/101 valores da planilha/u)).toBeTruthy();
  });

  it("aplica os limites calculados pelo método escolhido", async () => {
    stubSampleRequest();
    const { onApply } = renderFields();
    await loadSample();

    fireEvent.change(screen.getByLabelText(/Método/u), {
      target: { value: "equalInterval" },
    });
    fireEvent.click(screen.getByText("Usar estes limites"));

    expect(onApply).toHaveBeenCalledWith([25, 50, 75], 4);
  });

  /**
   * Regressão da regra que motivou o aviso: `catalogBuild` exige exatamente
   * `classes.length - 1` limites, então um método que deriva a própria
   * quantidade de faixas não pode ser aplicado a um índice classificatório sem
   * quebrar a validação na publicação.
   */
  it("bloqueia o método que mudaria a quantidade de classes vinda da tabela", async () => {
    stubSampleRequest();
    const { onApply } = renderFields({
      classCount: 6,
      canChangeClassCount: false,
    });
    await loadSample();

    fireEvent.change(screen.getByLabelText(/Método/u), {
      target: { value: "definedInterval" },
    });
    fireEvent.change(screen.getByLabelText(/Largura de cada faixa/u), {
      target: { value: "25" },
    });

    expect(screen.getByText(/exige exatamente/u)).toBeTruthy();
    const apply = screen.getByText("Usar estes limites") as HTMLButtonElement;
    expect(apply.disabled).toBe(true);
    fireEvent.click(apply);
    expect(onApply).not.toHaveBeenCalled();
  });

  /**
   * Regressão: a quantidade de faixas vinha do `classCount` do primeiro render,
   * em que a validação ainda não rodou e ele é zero. O campo ficava travado em
   * "0" depois que as classes apareciam, e todo método recusava o cálculo com
   * "Quantidade de faixas inválida".
   */
  it("acompanha a quantidade de classes que aparece depois da validação", async () => {
    stubSampleRequest();
    const { rerender, onApply } = renderFields({ classCount: 0 });
    await loadSample();

    rerender(4);
    fireEvent.change(screen.getByLabelText(/Método/u), {
      target: { value: "equalInterval" },
    });
    fireEvent.click(screen.getByText("Usar estes limites"));

    expect(onApply).toHaveBeenCalledWith([25, 50, 75], 4);
  });

  it("explica o erro do método em vez de sugerir limites inválidos", async () => {
    stubSampleRequest();
    renderFields();
    await loadSample();

    fireEvent.change(screen.getByLabelText(/Método/u), {
      target: { value: "definedInterval" },
    });
    fireEvent.change(screen.getByLabelText(/Largura de cada faixa/u), {
      target: { value: "80" },
    });

    expect(screen.getByText(/Um intervalo de 80 gera 2 faixa/u)).toBeTruthy();
    expect(screen.queryByText("Usar estes limites")).toBeNull();
  });
});
