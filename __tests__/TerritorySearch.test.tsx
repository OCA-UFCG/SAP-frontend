import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ReferenceOverlaysControl } from "@/components/MapControls/ReferenceOverlaysControl";
import {
  parseReferenceTerritories,
  searchReferenceTerritories,
} from "@/components/MapControls/referenceTerritories";

const FILE = {
  layers: [
    "quilombolas",
    "assentamentos",
    "terras_indigenas",
    "unidades_conservacao",
  ] as const,
  territories: [
    [2, "Kiriri", "BA", "Banzaê, Quijingue", -38.8, -10.9, -38.6, -10.7],
    [1, "PA LAGOA DO CAPIM", "PE", "Petrolina", -40.6, -9.4, -40.5, -9.3],
    [3, "PARQUE ESTADUAL DA LAGOA", "PI", "São Raimundo Nonato", -42.8, -9.1, -42.6, -8.9],
    [0, "Lagoa Grande", "BA", "Feira de Santana", -39, -12.3, -38.9, -12.2],
  ],
} as unknown as Parameters<typeof parseReferenceTerritories>[0];

const territories = parseReferenceTerritories(FILE);

describe("searchReferenceTerritories", () => {
  it("ignora acento e maiúscula no nome e no município", () => {
    expect(searchReferenceTerritories(territories, "KIRIRÍ")[0].name).toBe("Kiriri");
    expect(searchReferenceTerritories(territories, "banzae")[0].name).toBe("Kiriri");
  });

  it("põe na frente quem começa pelo que foi digitado", () => {
    const names = searchReferenceTerritories(territories, "lagoa").map((t) => t.name);
    expect(names).toEqual([
      "Lagoa Grande",
      "PA LAGOA DO CAPIM",
      "PARQUE ESTADUAL DA LAGOA",
    ]);
  });

  it("exige todas as palavras, em qualquer ordem", () => {
    const names = searchReferenceTerritories(territories, "lagoa petrolina").map((t) => t.name);
    expect(names).toEqual(["PA LAGOA DO CAPIM"]);
  });

  it("não busca com menos de duas letras", () => {
    expect(searchReferenceTerritories(territories, "l")).toEqual([]);
  });
});

describe("busca no cartão de Territórios", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("baixa a lista ao focar o campo e devolve o território escolhido", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(FILE),
    });
    vi.stubGlobal("fetch", fetchMock);
    const onSelectTerritory = vi.fn();

    render(
      <ReferenceOverlaysControl
        activeOverlays={new Set()}
        onToggle={() => {}}
        onSelectTerritory={onSelectTerritory}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Territórios" }));

    const input = screen.getByRole("combobox", { name: "Busca de território" });
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "kiriri" } });

    const option = await screen.findByRole("option", { name: /Kiriri/ });
    expect(option).toHaveTextContent("Terras Indígenas · Banzaê, Quijingue · BA");

    fireEvent.mouseDown(option);
    expect(onSelectTerritory).toHaveBeenCalledWith(
      expect.objectContaining({
        layerId: "terras_indigenas",
        name: "Kiriri",
        bounds: [-38.8, -10.9, -38.6, -10.7],
      }),
    );
    expect(input).toHaveValue("");
  });
});
