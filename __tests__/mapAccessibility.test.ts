import { describe, expect, it } from "vitest";
import {
  buildMapLibreLocale,
  describeMapView,
} from "@/components/Map/mapAccessibility";

describe("buildMapLibreLocale", () => {
  it("traduz o título do mapa e os botões de zoom pelas chaves do MapLibre", () => {
    const locale = buildMapLibreLocale((key) => `t:${key}`);

    expect(locale["Map.Title"]).toBe("t:mapTitle");
    expect(locale["NavigationControl.ZoomIn"]).toBe("t:zoomIn");
    expect(locale["NavigationControl.ZoomOut"]).toBe("t:zoomOut");
    expect(locale["Popup.Close"]).toBe("t:closePopup");
  });
});

describe("describeMapView", () => {
  it("diz a camada e o território", () => {
    expect(
      describeMapView({
        base: "Mapa",
        layerName: "Monitor de Secas",
        territoryName: "Paraíba",
      }),
    ).toBe("Mapa: Monitor de Secas, Paraíba");
  });

  it("omite a parte que falta em vez de deixar vírgula sobrando", () => {
    expect(
      describeMapView({ base: "Mapa", layerName: null, territoryName: "PB" }),
    ).toBe("Mapa: PB");
    expect(describeMapView({ base: "Mapa", layerName: "  " })).toBe("Mapa");
  });
});
