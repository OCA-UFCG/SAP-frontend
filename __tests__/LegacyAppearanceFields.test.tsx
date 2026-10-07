import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";

import { LegacyAppearanceFields } from "@/components/IndexCatalog/LegacyAppearanceFields";

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

const classifiedAppearance = {
  panelLayerId: "deg",
  periodCount: 2,
  appearance: {
    legendSource: "classes",
    legend: [
      { id: "muito-baixo", label: "Muito baixo", color: "#FFFFCC" },
      { id: "muito-alto", label: "Muito alto", color: "#BD0026" },
    ],
    paletteLength: 2,
  },
};

const singleValueAppearance = {
  panelLayerId: "pob_total",
  periodCount: 14,
  appearance: {
    legendSource: "mapVisualization.legend",
    legend: [
      { id: "0-20", label: "0-20", color: "#FFFFCC" },
      { id: "20-40", label: "20-40", color: "#FED976" },
    ],
    series: [
      { id: "familias", label: "Famílias em pobreza", color: "#BD0026" },
    ],
    thresholds: [20],
    thresholdUnit: "%",
    paletteLength: 2,
  },
};

function renderFields() {
  const onSaved = vi.fn();
  render(
    <LegacyAppearanceFields
      entryId="entry-legacy"
      inputClass="input"
      buttonClass="button"
      disabled={false}
      onSaved={onSaved}
    />,
  );
  return { onSaved };
}

function requestBody(call: number) {
  const [, init] = vi.mocked(fetch).mock.calls[call] as [string, RequestInit];
  return JSON.parse(String(init.body)) as Record<string, unknown>;
}

describe("LegacyAppearanceFields", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => jsonResponse(classifiedAppearance)),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("lê a legenda gravada e mostra rótulo e cor de cada linha", async () => {
    renderFields();

    expect(await screen.findByLabelText("Rótulo da faixa 1")).toHaveValue(
      "Muito baixo",
    );
    expect(screen.getByLabelText("Hexadecimal da faixa 2")).toHaveValue(
      "#BD0026",
    );
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe(
      "/api/index-catalog/entries/entry-legacy/appearance",
    );
  });

  it("diz que os rótulos valem para todos os períodos do índice", async () => {
    renderFields();

    expect(
      await screen.findByText(/valem para os 2 períodos/u),
    ).toBeInTheDocument();
  });

  it("envia apenas as linhas, nunca o imageData inteiro", async () => {
    const { onSaved } = renderFields();
    await screen.findByLabelText("Rótulo da faixa 1");

    fireEvent.change(screen.getByLabelText("Rótulo da faixa 1"), {
      target: { value: "Degradação baixa" },
    });
    vi.mocked(fetch).mockImplementationOnce(() =>
      jsonResponse({ ...classifiedAppearance, changed: "1 rótulo" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Salvar legenda e cores" }),
    );

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const [path, init] = vi.mocked(fetch).mock.calls[1] as [
      string,
      RequestInit,
    ];
    expect(path).toBe("/api/index-catalog/entries/entry-legacy/appearance");
    expect(init.method).toBe("PUT");
    const body = requestBody(1);
    expect(body.legend).toEqual([
      { id: "muito-baixo", label: "Degradação baixa", color: "#FFFFCC" },
      { id: "muito-alto", label: "Muito alto", color: "#BD0026" },
    ]);
    expect(body).not.toHaveProperty("imageData");
    expect(body).not.toHaveProperty("thresholds");
    expect(
      await screen.findByText(/Gravado: 1 rótulo\. Publique/u),
    ).toBeInTheDocument();
  });

  it("não oferece série nem limites num índice classificatório", async () => {
    renderFields();
    await screen.findByLabelText("Rótulo da faixa 1");

    expect(screen.queryByText("Série medida")).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("Limites entre as faixas"),
    ).not.toBeInTheDocument();
  });

  it("mostra a série medida e os limites num índice de valor único", async () => {
    vi.mocked(fetch).mockImplementation(() =>
      jsonResponse(singleValueAppearance),
    );
    renderFields();

    expect(await screen.findByLabelText("Rótulo da série 1")).toHaveValue(
      "Famílias em pobreza",
    );
    expect(screen.getByLabelText("Limites entre as faixas")).toHaveValue("20");
    expect(screen.getByText(/na unidade do asset \(%\)/u)).toBeInTheDocument();
  });

  it("manda os limites como números, e não como texto", async () => {
    vi.mocked(fetch).mockImplementation(() =>
      jsonResponse(singleValueAppearance),
    );
    renderFields();
    await screen.findByLabelText("Limites entre as faixas");

    fireEvent.change(screen.getByLabelText("Limites entre as faixas"), {
      target: { value: "30" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Salvar legenda e cores" }),
    );

    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2));
    expect(requestBody(1).thresholds).toEqual([30]);
    expect(requestBody(1).series).toEqual(
      singleValueAppearance.appearance.series,
    );
  });

  it("mostra a recusa do servidor sem perder o que estava na tela", async () => {
    renderFields();
    await screen.findByLabelText("Rótulo da faixa 1");

    fireEvent.change(screen.getByLabelText("Rótulo da faixa 1"), {
      target: { value: "Outro" },
    });
    vi.mocked(fetch).mockImplementationOnce(() =>
      jsonResponse(
        { error: "A paleta do mapa tem 2 cores e a legenda tem 3 linhas." },
        400,
      ),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Salvar legenda e cores" }),
    );

    expect(
      await screen.findByText(
        "A paleta do mapa tem 2 cores e a legenda tem 3 linhas.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Rótulo da faixa 1")).toHaveValue("Outro");
  });

  it("avisa quando a leitura da legenda falha", async () => {
    vi.mocked(fetch).mockImplementation(() =>
      jsonResponse({ error: "Este índice ainda não foi adotado." }, 400),
    );
    renderFields();

    expect(
      await screen.findByText("Este índice ainda não foi adotado."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Salvar legenda e cores" }),
    ).not.toBeInTheDocument();
  });
});
