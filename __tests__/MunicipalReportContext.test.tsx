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
        periods: ["2026-01"],
      },
    ],
    byMunicipality: {
      "5200050": {
        seca: "0",
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

  it("checks module availability from the local index without calling the report API", async () => {
    const user = userEvent.setup();

    render(<MunicipalReportContext panelLayers={panelLayers} />);

    await user.click(screen.getByRole("combobox"));
    await user.type(screen.getByRole("combobox"), "Abadia");
    await user.click(screen.getByRole("option", { name: "Abadia de Goiás - GO" }));

    await waitFor(() => {
      expect(screen.getByRole("checkbox")).toBeChecked();
    });
    expect(screen.getByText("Monitor de Secas")).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
