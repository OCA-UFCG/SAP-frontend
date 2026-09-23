import { act, cleanup, render } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/PlatformMap/PlatformMap", () => ({
  PlatformMap: () => null,
}));
vi.mock("@/components/SidePanelContexts/ModulesContext", () => ({
  ModulesContext: () => null,
}));
vi.mock("@/components/SidePanelContexts/AnalysisContext", () => ({
  AnalysisContext: () => null,
}));

import { CatalogMonitoringPreview } from "@/components/IndexCatalog/CatalogMonitoringPreview";
import {
  MapLayerProvider,
  useMapLayerActions,
  useMapLayerViewState,
} from "@/components/MapLayerContext/MapLayerContext";
import type { IndexCatalogPreview } from "@/types/indexCatalog";

const imageData = {
  schemaVersion: 1,
  type: "territorial-compact",
  defaultYear: "2025",
  classes: [{ id: "classe-0", label: "Classe 0", color: "#D9ED92" }],
  locations: { br: "Brasil" },
  years: {
    "2024": { imageId: "mapa-2024", values: {} },
    "2025": { imageId: "mapa-2025", values: {} },
  },
};

const panelLayer = {
  sys: { id: "entry-1" },
  id: "indice-aridez",
  name: "Índice de Aridez",
  imageData,
  tileApiPath: "/api/index-catalog/drafts/entry-1/ee",
} as unknown as IndexCatalogPreview["panelLayer"];

/** O que o operador escolheu na prévia, lido de fora do componente. */
const probe = {
  year: "",
  municipalityCode: null as string | null,
  choose: (year: string, municipalityCode: string) => {
    void year;
    void municipalityCode;
  },
};

function PreviewStateProbe() {
  const { activeYear, selectedMunicipalityCode } = useMapLayerViewState();
  const { setActiveYear, setSelectedMunicipalityCode } = useMapLayerActions();

  useEffect(() => {
    probe.year = activeYear;
    probe.municipalityCode = selectedMunicipalityCode;
    probe.choose = (year, municipalityCode) => {
      setActiveYear(year);
      setSelectedMunicipalityCode(municipalityCode);
    };
  });

  return null;
}

function renderPreview(layer: IndexCatalogPreview["panelLayer"]) {
  return render(
    <MapLayerProvider>
      <PreviewStateProbe />
      <CatalogMonitoringPreview preview={{ panelLayer: layer }} />
    </MapLayerProvider>,
  );
}

describe("CatalogMonitoringPreview", () => {
  afterEach(cleanup);

  it("starts on the default period of the index", () => {
    renderPreview(panelLayer);

    expect(probe.year).toBe("2025");
  });

  // Regressão: a captura da imagem do cartão guarda a URL dentro do mesmo
  // `panelLayer`, e a prévia se remontava por causa disso — o ano escolhido
  // voltava para o padrão e o município selecionado sumia poucos segundos
  // depois da escolha.
  it("keeps the period and the municipality the operator chose when only the preview image URL changes", () => {
    const { rerender } = renderPreview(panelLayer);

    act(() => probe.choose("2024", "2504009"));
    expect(probe.year).toBe("2024");

    rerender(
      <MapLayerProvider>
        <PreviewStateProbe />
        <CatalogMonitoringPreview
          preview={{
            panelLayer: {
              ...panelLayer,
              previewMap: { url: "https://images/previa.png" },
            } as unknown as IndexCatalogPreview["panelLayer"],
          }}
        />
      </MapLayerProvider>,
    );

    expect(probe.year).toBe("2024");
    expect(probe.municipalityCode).toBe("2504009");
  });

  it("goes back to the default period when the drawn layer really changes", () => {
    const { rerender } = renderPreview(panelLayer);

    act(() => probe.choose("2024", "2504009"));

    rerender(
      <MapLayerProvider>
        <PreviewStateProbe />
        <CatalogMonitoringPreview
          preview={{
            panelLayer: {
              ...panelLayer,
              imageData: { ...imageData, defaultYear: "2024" },
            } as unknown as IndexCatalogPreview["panelLayer"],
          }}
        />
      </MapLayerProvider>,
    );

    expect(probe.year).toBe("2024");
    expect(probe.municipalityCode).toBeNull();
  });
});
