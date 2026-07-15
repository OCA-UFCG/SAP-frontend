import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MunicipalReportContext } from "@/components/SidePanelContexts/MunicipalReportContext";
import type { PanelLayerI } from "@/utils/interfaces";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@/data/municipalAvailabilityIndex.json", () => ({
  default: {
    schemaVersion: 1,
    generatedAt: "2026-01-01T00:00:00.000Z",
    layers: [
      {
        panelLayerId: "seca",
        label: "Seca",
        order: 0,
        periods: ["2024"],
      },
      {
        panelLayerId: "futuro",
        label: "Índice futuro",
        order: 1,
        periods: ["2028"],
      },
      {
        panelLayerId: "sem-dados",
        label: "Sem dados",
        order: 2,
        periods: ["2026"],
      },
    ],
    byMunicipality: {
      "5200050": {
        seca: "0",
        futuro: "0",
      },
    },
  },
}));

const panelLayers: PanelLayerI[] = [
  {
    sys: { id: "sys-seca" },
    id: "seca",
    name: "Monitor de Secas",
    description: "Descricao",
    category: "Dados Climáticos",
    panelPosition: 1,
    previewMap: { url: "/preview.png" },
    imageData: {},
  },
  {
    sys: { id: "sys-futuro" },
    id: "futuro",
    name: "Índice futuro",
    description: "Descricao",
    category: "Dados Climáticos",
    panelPosition: 2,
    previewMap: { url: "/preview.png" },
    imageData: {},
  },
  {
    sys: { id: "sys-sem-dados" },
    id: "sem-dados",
    name: "Sem dados",
    description: "Descricao",
    category: "Dados Climáticos",
    panelPosition: 3,
    previewMap: { url: "/preview.png" },
    imageData: {},
  },
];

describe("MunicipalReportContext", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    pushMock.mockReset();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    cleanup();
    global.fetch = originalFetch;
  });

  it("starts checked and keeps every resolvable module selected without calling the report API", async () => {
    const user = userEvent.setup();

    render(<MunicipalReportContext panelLayers={panelLayers} />);

    expect(screen.getByRole("checkbox", { name: "Monitor de Secas" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Índice futuro" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Sem dados" })).toBeChecked();

    await user.click(screen.getByRole("combobox"));
    await user.type(screen.getByRole("combobox"), "Abadia");
    await user.click(screen.getByRole("option", { name: "Abadia de Goiás - GO" }));

    await waitFor(() => {
      expect(screen.getByRole("checkbox", { name: "Monitor de Secas" })).toBeChecked();
    });
    expect(screen.getByRole("checkbox", { name: "Índice futuro" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Sem dados" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Sem dados" })).toBeDisabled();
    expect(global.fetch).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Gerar relatório" }));
    expect(pushMock).toHaveBeenCalledOnce();
    const destination = pushMock.mock.calls[0]?.[0] as string;
    const params = new URL(destination, "https://example.test").searchParams;
    expect(params.get("layers")?.split(",").sort()).toEqual(["futuro", "seca"]);
  });
});
